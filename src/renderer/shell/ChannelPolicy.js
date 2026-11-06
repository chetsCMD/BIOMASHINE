export class ChannelPolicy {
    constructor(patterns) {
        this.exact = new Set();
        this.domains = new Set();
        for (const pattern of patterns || []) {
            if (pattern.endsWith(':*')) {
                this.domains.add(pattern.slice(0, -2));
            } else {
                this.exact.add(pattern);
            }
        }
    }

    allows(channel) {
        if (typeof channel !== 'string' || !channel.includes(':')) {
            return false;
        }
        const [domain] = channel.split(':');
        return this.exact.has(channel) || this.domains.has(domain);
    }
}
