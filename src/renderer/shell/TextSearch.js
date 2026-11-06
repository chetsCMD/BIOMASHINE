export class TextSearch {
    static normalize(value) {
        return String(value === null || value === undefined ? '' : value).toLowerCase().replace(/ё/g, 'е');
    }

    static isSubsequence(query, text) {
        let position = 0;
        for (const char of text) {
            if (char === query[position]) {
                position += 1;
            }
        }
        return position === query.length;
    }

    static fieldScore(query, text) {
        if (!text) {
            return 0;
        }
        if (text === query) {
            return 100;
        }
        if (text.startsWith(query)) {
            return 80;
        }
        if (text.includes(` ${query}`)) {
            return 60;
        }
        if (text.includes(query)) {
            return 40;
        }
        return TextSearch.isSubsequence(query, text) ? 10 : 0;
    }

    static score(query, fields) {
        const normalized = TextSearch.normalize(query).trim();
        if (!normalized) {
            return 1;
        }
        let best = 0;
        fields.forEach((field, index) => {
            const value = TextSearch.fieldScore(normalized, TextSearch.normalize(field)) / (1 + index * 0.25);
            best = Math.max(best, value);
        });
        return best;
    }

    static filter(items, query, fieldsOf) {
        return items
            .map((item) => ({ item, score: TextSearch.score(query, fieldsOf(item)) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((entry) => entry.item);
    }
}
