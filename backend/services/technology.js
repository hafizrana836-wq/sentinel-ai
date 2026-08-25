function detectTechnology(headers){
    let technologies = [];
    const server =
    headers["server"] || "";
    const poweredBy =
    headers["x-powered-by"] || "";
    if(server){
        technologies.push({
            name:"Server",
            value:server
        });
    }
    if(poweredBy){
        technologies.push({
            name:"Powered By",
            value:poweredBy
        });
    }
    const allHeaders =
    JSON.stringify(headers).toLowerCase();
// Compression
if (headers["content-encoding"]) {
    technologies.push({
        name: "Compression",
        value: headers["content-encoding"]
    });
}
// HTTP Version (if available)
if (headers["x-http-version"]) {
    technologies.push({
        name: "HTTP Version",
        value: headers["x-http-version"]
    });
}
// PHP
if (poweredBy.toLowerCase().includes("php")) {
    technologies.push({
        name: "Language",
        value: "PHP"
    });
}
// Express
if (poweredBy.toLowerCase().includes("express")) {
    technologies.push({
        name: "Framework",
        value: "Express.js"
    });
}
// ASP.NET
if (poweredBy.toLowerCase().includes("asp.net")) {
    technologies.push({
        name: "Framework",
        value: "ASP.NET"
    });
}
// LiteSpeed
if (allHeaders.includes("litespeed")) {
    technologies.push({
        name: "Web Server",
        value: "LiteSpeed"
    });
}
// Microsoft IIS
if (allHeaders.includes("iis")) {
    technologies.push({
        name: "Web Server",
        value: "Microsoft IIS"
    });
}
// Akamai
if (allHeaders.includes("akamai")) {
    technologies.push({
        name: "CDN",
        value: "Akamai"
    });
}
// Fastly
if (allHeaders.includes("fastly")) {
    technologies.push({
        name: "CDN",
        value: "Fastly"
    });
}
// Drupal
if (allHeaders.includes("drupal")) {
    technologies.push({
        name: "CMS",
        value: "Drupal"
    });
}
// Joomla
if (allHeaders.includes("joomla")) {
    technologies.push({
        name: "CMS",
        value: "Joomla"
    });
}
    if(allHeaders.includes("cloudflare")){
        technologies.push({
            name:"CDN",
            value:"Cloudflare"
        });
    }
    if(allHeaders.includes("wordpress")){
        technologies.push({
            name:"CMS",
            value:"WordPress"
        });
    }
    if(allHeaders.includes("next")){
        technologies.push({
            name:"Framework",
            value:"Next.js"
        });
    }
    if(allHeaders.includes("nginx")){
        technologies.push({
            name:"Web Server",
            value:"Nginx"
        });
    }
    if(allHeaders.includes("apache")){
        technologies.push({
            name:"Web Server",
            value:"Apache"
        });
    }
// Google infrastructure
if (allHeaders.includes("gws") || server.toLowerCase().includes("google")) {
    technologies.push({
        name: "CDN",
        value: "Google Edge Network"
    });
}
// Vercel
if (allHeaders.includes("vercel")) {
    technologies.push({
        name: "Platform",
        value: "Vercel"
    });
}
    if(technologies.length === 0){
        technologies.push({
            name:"Unknown",
            value:"No technology detected"
        });
    }
technologies = technologies.filter(
    (item, index, self) =>
        index === self.findIndex(
            t => t.name === item.name && t.value === item.value
        )
);
    return technologies;
}
module.exports = detectTechnology;
