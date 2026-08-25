import React, { useState } from "react";
import "./Footer.css";

const productLinks = [
  { label: "Features", href: "#" },
  { label: "Live scan demo", href: "#live-demo" },
  { label: "Pricing", href: "#" },
  { label: "Changelog", href: "#" },
];

const resourceLinks = [
  { label: "Documentation", href: "#" },
  { label: "API reference", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Status", href: "#" },
];

const companyLinks = [
  { label: "About", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Contact", href: "#" },
  { label: "Security", href: "#" },
];

const IconX = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.2l-5.6-6.9L4 22H1l8.1-9.3L0.9 2h7.4l5.1 6.4L18.9 2Zm-1.3 18h2L6.5 4H4.4l13.2 16Z" />
  </svg>
);

const IconGithub = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 .5C5.7.5.8 5.4.8 11.7c0 5 3.2 9.2 7.7 10.7.6.1.8-.2.8-.6v-2.2c-3.1.7-3.8-1.4-3.8-1.4-.5-1.3-1.2-1.7-1.2-1.7-1-.7.1-.6.1-.6 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.2-5.1-5.5 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.5.1-3.1 0 0 .9-.3 3 1.1a10.4 10.4 0 0 1 5.4 0c2.1-1.4 3-1.1 3-1.1.6 1.6.2 2.8.1 3.1.7.8 1.1 1.8 1.1 3 0 4.3-2.6 5.2-5.1 5.5.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6a11.2 11.2 0 0 0 7.7-10.7C23.2 5.4 18.3.5 12 .5Z" />
  </svg>
);

const IconLinkedIn = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V21h-4V9Z" />
  </svg>
);

function FooterColumn({ title, links }) {
  return (
    <div className="footer-col">
      <h4 className="footer-col__title">{title}</h4>
      <ul className="footer-col__list">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Footer
 * Brand blurb + newsletter CTA, three link columns, social icons,
 * and a bottom bar with copyright + legal links.
 */
export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <div className="footer__logo">
            <span className="footer__logo-mark" />
            Sentinel AI
          </div>
          <p className="footer__tagline">
            AI-powered website security scanning — SSL, headers, ports, and
            CVEs, checked in seconds.
          </p>

          <form className="footer__newsletter" onSubmit={handleSubmit}>
            {subscribed ? (
              <span className="footer__subscribed">
                You're on the list — we'll be in touch.
              </span>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="footer__input"
                  aria-label="Email address"
                  required
                />
                <button type="submit" className="footer__subscribe-btn">
                  Get updates
                </button>
              </>
            )}
          </form>
        </div>

        <div className="footer__columns">
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Resources" links={resourceLinks} />
          <FooterColumn title="Company" links={companyLinks} />
        </div>
      </div>

      <div className="footer__bottom">
        <span className="footer__copyright">
          © {new Date().getFullYear()} Sentinel AI. All rights reserved.
        </span>

        <div className="footer__social">
          <a href="#" aria-label="X (Twitter)"><IconX /></a>
          <a href="#" aria-label="GitHub"><IconGithub /></a>
          <a href="#" aria-label="LinkedIn"><IconLinkedIn /></a>
        </div>

        <div className="footer__legal">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>
    </footer>
  );
}
