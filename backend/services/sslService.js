// Place this file at: services/sslService.js
const tls = require("tls");
const dns = require("dns");
const crypto = require("crypto");

const WEAK_CIPHER_PATTERN = /RC4|DES|MD5|NULL|EXPORT|anon/i;
const DEPRECATED_VERSIONS = ["TLSv1", "TLSv1.1"];

/**
 * Walks the certificate chain the server actually presented during the
 * handshake (via Node's issuerCertificate links). "leaf only" / "partial" is
 * a statement about what the server sent, not automatically a vulnerability —
 * riskEngine.js scores it as a low-severity observation, not a critical finding.
 */
function inspectChain(leafCert) {
  const chain = [];
  const seen = new Set();
  let current = leafCert;

  while (current && current.subject && current.fingerprint && !seen.has(current.fingerprint)) {
    chain.push({
      subject: current.subject?.CN || null,
      issuer: current.issuer?.CN || null,
      validTo: current.valid_to || null,
    });
    seen.add(current.fingerprint);

    const next = current.issuerCertificate;
    if (!next || next.fingerprint === current.fingerprint) break;
    current = next;
  }

  const last = chain[chain.length - 1];
  const reachedSelfSigned = !!last && last.subject && last.subject === last.issuer;

  return {
    length: chain.length,
    complete: chain.length > 1 && reachedSelfSigned,
    status: chain.length <= 1 ? "leaf_only" : reachedSelfSigned ? "complete" : "partial",
    chain,
  };
}

// Public-key algorithm + size, using Node's built-in crypto.X509Certificate —
// no external library needed. RSA keys report modulusLength; EC keys don't
// (bit-length isn't a comparable weakness measure for EC, so keyBits stays
// null and the "short key" rule correctly never fires for them).
function inspectPublicKey(certDER) {
  try {
    const x509 = new crypto.X509Certificate(certDER);
    const pubKey = x509.publicKey;
    const keyAlgorithm = pubKey.asymmetricKeyType || null;
    const keyBits =
      keyAlgorithm === "rsa" || keyAlgorithm === "rsa-pss" ? pubKey.asymmetricKeyDetails?.modulusLength || null : null;
    const namedCurve = keyAlgorithm === "ec" ? pubKey.asymmetricKeyDetails?.namedCurve || null : null;
    return { status: "inspected", keyAlgorithm, keyBits, namedCurve };
  } catch (err) {
    return { status: "not_inspected", reason: err.message };
  }
}

// CAA (Certification Authority Authorization). NOTE: checks the exact
// hostname only — full RFC 6844 behavior climbs parent domains until a CAA
// record (or the registrable root) is found; not implemented here.
async function checkCAA(hostname) {
  try {
    const records = await dns.promises.resolveCaa(hostname);
    return records || [];
  } catch {
    return [];
  }
}

function connectMain(hostname, port, timeoutMs) {
  return new Promise((resolve) => {
    let socket;
    try {
      socket = tls.connect(
        { host: hostname, port, servername: hostname, timeout: timeoutMs, rejectUnauthorized: false },
        () => {
          const cert = socket.getPeerCertificate(true); // true = include chain via issuerCertificate
          const protocol = socket.getProtocol();
          const cipher = socket.getCipher(); // { name, standardName, version }

          if (!cert || Object.keys(cert).length === 0) {
            socket.end();
            return resolve({ valid: false, reason: "No certificate returned" });
          }

          const authorized = socket.authorized;
          const authError = socket.authorizationError;
          const now = Date.now();
          const validTo = new Date(cert.valid_to).getTime();
          const validFrom = new Date(cert.valid_from).getTime();
          const daysRemaining = Math.round((validTo - now) / (1000 * 60 * 60 * 24));

          const chainInfo = inspectChain(cert);
          const keyInfo = inspectPublicKey(cert.raw);

          socket.end();
          resolve({
            valid: authorized && now >= validFrom && now <= validTo,
            authorized,
            authError: authorized ? null : String(authError || "Untrusted certificate"),
            protocol,
            issuer: cert.issuer?.O || cert.issuer?.CN || "Unknown",
            subject: cert.subject?.CN || hostname,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysRemaining,
            expiringSoon: daysRemaining <= 14,
            isWeakProtocol: DEPRECATED_VERSIONS.includes(protocol),

            cipher: cipher?.name || null,
            cipherStandardName: cipher?.standardName || null,

            keyAlgorithm: keyInfo.keyAlgorithm,
            keyBits: keyInfo.keyBits,
            namedCurve: keyInfo.namedCurve,
            publicKey: keyInfo, // { status, keyAlgorithm, keyBits, namedCurve } — kept for the raw/full picture

            fingerprintSHA256: cert.fingerprint256 || null,
            certificateChain: chainInfo,
            chainComplete: chainInfo.complete,
            chainLength: chainInfo.length,
          });
        }
      );
    } catch (err) {
      return resolve({ valid: false, reason: err.message });
    }

    socket.on("error", (err) => resolve({ valid: false, reason: err.message }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ valid: false, reason: "Connection timed out" });
    });
  });
}

// Explicitly forces the handshake down to TLS 1.0/1.1 to see if the server
// still accepts it, even though our normal connection above negotiated
// something stronger by default. This is a genuine downgrade test, not an
// inference from the main connection.
function probeDeprecatedVersion(hostname, port, version, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let socket;
    try {
      socket = tls.connect(
        { host: hostname, port, servername: hostname, timeout: timeoutMs, rejectUnauthorized: false, minVersion: version, maxVersion: version },
        () => {
          socket.end();
          resolve(true);
        }
      );
    } catch {
      return resolve(false);
    }
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// Explicitly offers ONLY weak/deprecated ciphers and sees whether the server
// accepts any of them — a direct test, not just inspecting whichever cipher
// our normal connection happened to negotiate.
function probeWeakCiphers(hostname, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let socket;
    try {
      socket = tls.connect(
        {
          host: hostname,
          port,
          servername: hostname,
          timeout: timeoutMs,
          rejectUnauthorized: false,
          minVersion: "TLSv1",
          maxVersion: "TLSv1.2",
          ciphers: "RC4:DES-CBC-SHA:DES-CBC3-SHA:EXPORT:NULL:eNULL:aNULL:MD5",
        },
        () => {
          const cipher = socket.getCipher();
          socket.end();
          resolve(cipher || null);
        }
      );
    } catch {
      return resolve(null);
    }
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

/**
 * Connects to the target on port 443, inspects the live certificate, probes
 * for deprecated TLS versions and weak ciphers, checks CAA records — all
 * with Node's built-in tls/dns/crypto modules, no external API or library.
 */
async function checkSSL(hostname, port = 443, timeoutMs = 8000) {
  const [main, tls10Supported, tls11Supported, weakCipherProbe, caa] = await Promise.all([
    connectMain(hostname, port, timeoutMs),
    probeDeprecatedVersion(hostname, port, "TLSv1", timeoutMs),
    probeDeprecatedVersion(hostname, port, "TLSv1.1", timeoutMs),
    probeWeakCiphers(hostname, port, timeoutMs),
    checkCAA(hostname),
  ]);

  if (!main.valid && main.reason) {
    // main handshake failed outright — still report what we could,
    // but skip layering on probes that need a working connection context.
    return { ...main, caaRecords: caa };
  }

  const supportedProtocols = [tls10Supported && "TLSv1", tls11Supported && "TLSv1.1"].filter(Boolean);
  const deprecatedProtocolSupported = supportedProtocols.length > 0;

  const mainCipherWeak = main.cipher && WEAK_CIPHER_PATTERN.test(main.cipher);
  const isWeakCipher = !!mainCipherWeak || !!weakCipherProbe;

  return {
    ...main,
    deprecatedProtocolSupported,
    supportedProtocols,
    isWeakCipher,
    weakCipherEvidence: weakCipherProbe ? { name: weakCipherProbe.name } : null,
    caaRecords: caa,
  };
}

module.exports = { checkSSL };
