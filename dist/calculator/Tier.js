export class Tier {
    constructor(name, infantry, cavalry, archers) {
        this.name = name;
        this.infantry = infantry;
        this.cavalry = cavalry;
        this.archers = archers;
        this.name = name;
        this.infantry = infantry;
        this.cavalry = cavalry;
        this.archers = archers;
    }
    getTotal() {
        return this.infantry + this.cavalry + this.archers;
    }
    add(other, factor) {
        const f = factor !== undefined ? factor : 1;
        this.infantry += other.infantry * f;
        this.cavalry += other.cavalry * f;
        this.archers += other.archers * f;
    }
}
