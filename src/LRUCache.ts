export class LRUCache<K, V> {
    private cache: Map<K, V>;
    private readonly maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value as K;
            if (firstKey !== undefined) {
                const evictedValue = this.cache.get(firstKey);
                this.cache.delete(firstKey);
                this.clearValue(evictedValue);
            }
        }
        this.cache.set(key, value);
    }

    has(key: K): boolean {
        return this.cache.has(key);
    }

    delete(key: K): boolean {
        const value = this.cache.get(key);
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.clearValue(value);
        }
        return deleted;
    }

    clear(): void {
        for (const value of this.cache.values()) {
            this.clearValue(value);
        }
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }

    private clearValue(value: V | undefined): void {
        if (value === undefined || value === null) return;
        
        if (Array.isArray(value)) {
            value.length = 0;
        } else if (value instanceof Set) {
            value.clear();
        } else if (value instanceof Map) {
            value.clear();
        }
    }
}
