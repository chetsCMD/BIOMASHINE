const fs = require('fs');
const { protocol } = require('electron');
const MimeTypes = require('./core/MimeTypes');

class ProtocolHandler {
    constructor(scheme, resolver, design, appHost, virtualPath) {
        this.scheme = scheme;
        this.resolver = resolver;
        this.design = design;
        this.appHost = appHost;
        this.virtualPath = virtualPath;
    }

    static registerPrivileged(scheme) {
        protocol.registerSchemesAsPrivileged([
            { scheme, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
        ]);
    }

    attach() {
        protocol.handle(this.scheme, (request) => this.respond(request.url));
    }

    isVirtualDesign(requestUrl) {
        try {
            const url = new URL(requestUrl);
            return url.hostname === this.appHost && url.pathname === this.virtualPath;
        } catch (error) {
            return false;
        }
    }

    respond(requestUrl) {
        if (this.isVirtualDesign(requestUrl)) {
            return new Response(this.design.css(), {
                status: 200,
                headers: { 'Content-Type': MimeTypes.forFile('design.css'), 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
            });
        }
        const filePath = this.resolver.resolve(requestUrl);
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return new Response('Not found', { status: 404 });
        }
        const body = filePath.endsWith('.css') ? this.design.expand(fs.readFileSync(filePath, 'utf8')) : fs.readFileSync(filePath);
        return new Response(body, {
            status: 200,
            headers: {
                'Content-Type': MimeTypes.forFile(filePath),
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

module.exports = ProtocolHandler;
