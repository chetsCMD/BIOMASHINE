const fs = require('fs');
const { protocol } = require('electron');
const MimeTypes = require('./core/MimeTypes');

class ProtocolHandler {
    constructor(scheme, resolver) {
        this.scheme = scheme;
        this.resolver = resolver;
    }

    static registerPrivileged(scheme) {
        protocol.registerSchemesAsPrivileged([
            { scheme, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
        ]);
    }

    attach() {
        protocol.handle(this.scheme, (request) => this.respond(request.url));
    }

    respond(requestUrl) {
        const filePath = this.resolver.resolve(requestUrl);
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return new Response('Not found', { status: 404 });
        }
        return new Response(fs.readFileSync(filePath), {
            status: 200,
            headers: {
                'Content-Type': MimeTypes.forFile(filePath),
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

module.exports = ProtocolHandler;
