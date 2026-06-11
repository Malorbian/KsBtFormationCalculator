type TierName = "T5" | "T6" | "T7" | "T8" | "T9" | "T10";
type TroopType = "infantry" | "cavalry" | "archers";

interface FormationResult {
    joinFormation: TroopComposition;
    hostFormation: TroopComposition;
}


class Tier {
    public constructor(
        public name: TierName,
        public infantry: number,
        public cavalry: number,
        public archers: number
    ) {
        this.name = name;
        this.infantry = infantry;
        this.cavalry = cavalry;
        this.archers = archers;
    }

    public getTotal(): number {
        return this.infantry + this.cavalry + this.archers;
    }

    public add(other: Tier, factor?: number): void {
        const f = factor !== undefined ? factor : 1;
        this.infantry += other.infantry * f;
        this.cavalry += other.cavalry * f;
        this.archers += other.archers * f;
    }
}


class TroopComposition {
    public readonly name: string;
    public T8: Tier;
    public T9: Tier;
    public T10: Tier;

    public T5: Tier;
    public T6: Tier;
    public T7: Tier;

    public constructor(name: string, T5: Tier, T6: Tier, T7: Tier, T8: Tier, T9: Tier, T10: Tier) {
        this.name = name;
        this.T5 = T5;
        this.T6 = T6;
        this.T7 = T7;
        this.T8 = T8;
        this.T9 = T9;
        this.T10 = T10;
    }

    public getTotal(): number {
        return this.T5.getTotal() + this.T6.getTotal() + this.T7.getTotal() + this.T8.getTotal() + this.T9.getTotal() + this.T10.getTotal();
    }

    private getTroopTypeTotal(
        tiers: Record<TierName, Tier>,
        troopType: TroopType
    ): number {
        return tiers["T5"][troopType]
            + tiers["T6"][troopType]
            + tiers["T7"][troopType]
            + tiers["T8"][troopType]
            + tiers["T9"][troopType]
            + tiers["T10"][troopType];
    }

    public calculateFormations(
        marchCount: number,
        marchCap: number,
        joinCap: number,
        hostOwn: boolean
    ): FormationResult {
        const divisor = marchCount + (hostOwn ? 1 : 0);

        if (divisor <= 0) {
            throw new Error("March count must be greater than 0.");
        }

        const joinTiers = {
            T5: new Tier(
                "T5",
                Math.ceil(this.T5.infantry / divisor),
                Math.ceil(this.T5.cavalry / divisor),
                Math.ceil(this.T5.archers / divisor)
            ),
            T6: new Tier(
                "T6",
                Math.ceil(this.T6.infantry / divisor),
                Math.ceil(this.T6.cavalry / divisor),
                Math.ceil(this.T6.archers / divisor)
            ),
            T7: new Tier(
                "T7",
                Math.ceil(this.T7.infantry / divisor),
                Math.ceil(this.T7.cavalry / divisor),
                Math.ceil(this.T7.archers / divisor)
            ),
            T8: new Tier(
                "T8",
                Math.ceil(this.T8.infantry / divisor),
                Math.ceil(this.T8.cavalry / divisor),
                Math.ceil(this.T8.archers / divisor)
            ),
            T9: new Tier(
                "T9",
                Math.ceil(this.T9.infantry / divisor),
                Math.ceil(this.T9.cavalry / divisor),
                Math.ceil(this.T9.archers / divisor)
            ),
            T10: new Tier(
                "T10",
                Math.ceil(this.T10.infantry / divisor),
                Math.ceil(this.T10.cavalry / divisor),
                Math.ceil(this.T10.archers / divisor)
            )
        };

        const removedTiers = {
            T5: new Tier("T5", 0, 0, 0),
            T6: new Tier("T6", 0, 0, 0),
            T7: new Tier("T7", 0, 0, 0),
            T8: new Tier("T8", 0, 0, 0),
            T9: new Tier("T9", 0, 0, 0),
            T10: new Tier("T10", 0, 0, 0)
        };

        this.trimToCap(joinTiers, joinCap, removedTiers);

        const hostTiers = {
            T5: new Tier("T5", joinTiers.T5.infantry, joinTiers.T5.cavalry, joinTiers.T5.archers),
            T6: new Tier("T6", joinTiers.T6.infantry, joinTiers.T6.cavalry, joinTiers.T6.archers),
            T7: new Tier("T7", joinTiers.T7.infantry, joinTiers.T7.cavalry, joinTiers.T7.archers),
            T8: new Tier("T8", joinTiers.T8.infantry, joinTiers.T8.cavalry, joinTiers.T8.archers),
            T9: new Tier("T9", joinTiers.T9.infantry, joinTiers.T9.cavalry, joinTiers.T9.archers),
            T10: new Tier("T10", joinTiers.T10.infantry, joinTiers.T10.cavalry, joinTiers.T10.archers),
        };

        if (hostOwn) {
            hostTiers.T8.add(removedTiers.T8, divisor);
            hostTiers.T9.add(removedTiers.T9, divisor);
            hostTiers.T10.add(removedTiers.T10, divisor);

            this.trimToCap(hostTiers, marchCap);
        }

        return {
            joinFormation: TroopComposition.fromMutable("Join Formation", joinTiers),
            hostFormation: TroopComposition.fromMutable("Host Formation", hostTiers)
        };
    }


    private trimToCap(
        tiers: Record<TierName, Tier>,
        cap: number,
        removedTarget?: Record<TierName, Tier>
    ): void {
        const removeOrder: Array<[TierName, TroopType]> = [
            ["T5", "infantry"],
            ["T6", "infantry"],
            ["T7", "infantry"],
            ["T8", "infantry"],
            ["T5", "cavalry"],
            ["T9", "infantry"],
            ["T6", "cavalry"],
            ["T5", "archers"],
            ["T10", "infantry"],
            ["T7", "cavalry"],
            ["T6", "archers"],
            ["T8", "cavalry"],
            ["T7", "archers"],
            ["T9", "cavalry"],
            ["T8", "archers"],
            ["T10", "cavalry"],
            ["T9", "archers"],
            ["T10", "archers"]
        ];

        let currentCount = this.getMutableTotal(tiers);
        if (currentCount <= cap) {
            return;
        }
        let toRemove = currentCount - cap;
        const minTroopsPerType = cap >= 100 ? Math.ceil(cap * 0.1) : 0; 

        while (toRemove > 0) {
            let removedSomething = false;

            for (const [tierName, troopType] of removeOrder) {
                if (toRemove <= 0) break;

                const tier = tiers[tierName];
                const currentTroopTypeTotal = this.getTroopTypeTotal(tiers, troopType);
                const removableFromType = currentTroopTypeTotal - minTroopsPerType;

                const removableFromTier = Math.min(
                    tier[troopType], 
                    removableFromType, 
                    toRemove
                );

                if (removableFromTier <= 0) continue;

                tier[troopType] -= removableFromTier;
                if (removedTarget) {
                    removedTarget[tierName][troopType] += removableFromTier;
                }
                toRemove -= removableFromTier;
                removedSomething = true;
            }
            
            if (!removedSomething) {
                break;
            }
        }
    }

    private getMutableTotal(tiers: Record<TierName, Tier>): number {
        return tiers.T5.getTotal() + tiers.T6.getTotal() + tiers.T7.getTotal() + tiers.T8.getTotal() + tiers.T9.getTotal() + tiers.T10.getTotal();
    }

    private static fromMutable(
        name: string,
        tiers: Record<TierName, Tier>
    ): TroopComposition {
        return new TroopComposition(
            name,
            tiers.T5,
            tiers.T6,
            tiers.T7,
            tiers.T8,
            tiers.T9,
            tiers.T10
        );
    }
}

// --- UI binding ---------------------------------------------------------
function readInt(id: string, fallback = 0): number {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return fallback;
    const v = parseInt(el.value, 10);
    return Number.isFinite(v) ? v : fallback;
}

function readBool(id: string): boolean {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return !!(el && el.checked);
}

function setOutput(id: string, value: number | string) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.value = String(value);
}

function calculateAndFillOutputs(): void {
    const t10Inf = readInt('t10-infantry', 0);
    const t10Cav = readInt('t10-cavalry', 0);
    const t10Arc = readInt('t10-archer', 0);

    const t9Inf = readInt('t9-infantry', 0);
    const t9Cav = readInt('t9-cavalry', 0);
    const t9Arc = readInt('t9-archer', 0);

    const t8Inf = readInt('t8-infantry', 0);
    const t8Cav = readInt('t8-cavalry', 0);
    const t8Arc = readInt('t8-archer', 0);

    const t7Inf = readInt('t7-infantry', 0);
    const t7Cav = readInt('t7-cavalry', 0);
    const t7Arc = readInt('t7-archer', 0);

    const t6Inf = readInt('t6-infantry', 0);
    const t6Cav = readInt('t6-cavalry', 0);
    const t6Arc = readInt('t6-archer', 0);

    const t5Inf = readInt('t5-infantry', 0);
    const t5Cav = readInt('t5-cavalry', 0);
    const t5Arc = readInt('t5-archer', 0);

    const marchCap = readInt('march-cap', 0);
    const joinCap = readInt('join-cap', 0);
    const marchCount = readInt('max-marches', 0);
    const hostOwn = readBool('host-own-rally');

    const host_comp = new TroopComposition(
        'Input',
        new Tier('T5', t5Inf, t5Cav, t5Arc),
        new Tier('T6', t6Inf, t6Cav, t6Arc),
        new Tier('T7', t7Inf, t7Cav, t7Arc),
        new Tier('T8', t8Inf, t8Cav, t8Arc),
        new Tier('T9', t9Inf, t9Cav, t9Arc),
        new Tier('T10', t10Inf, t10Cav, t10Arc)
    );

    const resultsEl = document.getElementById('results');
    try {
        const res = host_comp.calculateFormations(marchCount, marchCap, joinCap, hostOwn);

        // fill join outputs
        setOutput('join-t10-infantry', res.joinFormation.T10.infantry);
        setOutput('join-t10-cavalry', res.joinFormation.T10.cavalry);
        setOutput('join-t10-archer', res.joinFormation.T10.archers);

        setOutput('join-t9-infantry', res.joinFormation.T9.infantry);
        setOutput('join-t9-cavalry', res.joinFormation.T9.cavalry);
        setOutput('join-t9-archer', res.joinFormation.T9.archers);

        setOutput('join-t8-infantry', res.joinFormation.T8.infantry);
        setOutput('join-t8-cavalry', res.joinFormation.T8.cavalry);
        setOutput('join-t8-archer', res.joinFormation.T8.archers);

        setOutput('join-t7-infantry', res.joinFormation.T7.infantry);
        setOutput('join-t7-cavalry', res.joinFormation.T7.cavalry);
        setOutput('join-t7-archer', res.joinFormation.T7.archers);

        setOutput('join-t6-infantry', res.joinFormation.T6.infantry);
        setOutput('join-t6-cavalry', res.joinFormation.T6.cavalry);
        setOutput('join-t6-archer', res.joinFormation.T6.archers);

        setOutput('join-t5-infantry', res.joinFormation.T5.infantry);
        setOutput('join-t5-cavalry', res.joinFormation.T5.cavalry);
        setOutput('join-t5-archer', res.joinFormation.T5.archers);

        // fill host outputs
        setOutput('host-t10-infantry', res.hostFormation.T10.infantry);
        setOutput('host-t10-cavalry', res.hostFormation.T10.cavalry);
        setOutput('host-t10-archer', res.hostFormation.T10.archers);

        setOutput('host-t9-infantry', res.hostFormation.T9.infantry);
        setOutput('host-t9-cavalry', res.hostFormation.T9.cavalry);
        setOutput('host-t9-archer', res.hostFormation.T9.archers);


        setOutput('host-t8-infantry', res.hostFormation.T8.infantry);
        setOutput('host-t8-cavalry', res.hostFormation.T8.cavalry);
        setOutput('host-t8-archer', res.hostFormation.T8.archers);

        setOutput('host-t7-infantry', res.hostFormation.T7.infantry);
        setOutput('host-t7-cavalry', res.hostFormation.T7.cavalry);
        setOutput('host-t7-archer', res.hostFormation.T7.archers);

        setOutput('host-t6-infantry', res.hostFormation.T6.infantry);
        setOutput('host-t6-cavalry', res.hostFormation.T6.cavalry);
        setOutput('host-t6-archer', res.hostFormation.T6.archers);

        setOutput('host-t5-infantry', res.hostFormation.T5.infantry);
        setOutput('host-t5-cavalry', res.hostFormation.T5.cavalry);
        setOutput('host-t5-archer', res.hostFormation.T5.archers);

        if (resultsEl) resultsEl.textContent = 'Formations calculated.';
    } catch (err) {
        if (resultsEl) resultsEl.textContent = String((err as Error).message || 'Calculation error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calculator-form') as HTMLFormElement | null;
    if (!form) return;

    // prevent form submit from clearing inputs / reloading page
    form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        calculateAndFillOutputs();
    });

    // also calculate live on input change without clearing
    form.addEventListener('input', () => {
        calculateAndFillOutputs();
    });

    // initial fill
    calculateAndFillOutputs();

    // make tiers expandable/collapsible when header is clicked or activated via keyboard
    document.querySelectorAll('.tier .tier-header').forEach((hdr) => {
        const header = hdr as HTMLElement;
        const tierEl = header.closest('.tier') as HTMLElement | null;
        // do not make the options panel expandable
        if (tierEl && tierEl.id === 'options') {
            header.tabIndex = -1;
            header.setAttribute('aria-expanded', 'true');
            return;
        }

        header.tabIndex = 0;
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', 'true');

        const toggle = () => {
            const tier = header.closest('.tier') as HTMLElement | null;
            if (!tier) return;
            const collapsed = tier.classList.toggle('collapsed');
            header.setAttribute('aria-expanded', String(!collapsed));
        };

        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                toggle();
            }
        });
    });

    // collapse T5-T7 tiers by default (inputs + join + host)
    const initialCollapsedIds = [
        'tier-t5','tier-t6','tier-t7',
        'join-tier-t5','join-tier-t6','join-tier-t7',
        'host-tier-t5','host-tier-t6','host-tier-t7'
    ];
    initialCollapsedIds.forEach((id) => {
        const el = document.getElementById(id) as HTMLElement | null;
        if (!el) return;
        el.classList.add('collapsed');
        const hdr = el.querySelector('.tier-header') as HTMLElement | null;
        if (hdr) hdr.setAttribute('aria-expanded', 'false');
    });


    // --- Info modal (images + video) ---------------------------------
    const modal = document.getElementById('info-modal') as HTMLElement | null;
    const imgEl = document.getElementById('info-image') as HTMLImageElement | null;
    const videoEl = document.getElementById('info-video') as HTMLVideoElement | null;
    const imageSet = [
        'res\\TotalTroops.png',
        'res\\squad.png',
        'res\\TotalTroopsCalc.png',
        'res\\FormationsCalc.png'
    ];
    const videoSrc = 'res\\FormationsVid.mp4';
    let currentImageIndex = 0;

    function openImageModal(startIndex = 0) {
        if (!modal || !imgEl) return;
        currentImageIndex = startIndex % imageSet.length;
        imgEl.src = imageSet[currentImageIndex];
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        // show images, hide video
        const imagesWrap = modal.querySelector('.info-images') as HTMLElement | null;
        const videoWrap = modal.querySelector('.info-video') as HTMLElement | null;
        if (imagesWrap) imagesWrap.style.display = '';
        if (videoWrap) videoWrap.style.display = 'none';
        if (videoEl) { videoEl.pause(); videoEl.currentTime = 0; }
    }

    function openVideoModal() {
        if (!modal || !videoEl) return;
        const srcEl = document.getElementById('info-video-src') as HTMLSourceElement | null;
        if (srcEl) srcEl.src = videoSrc;
        videoEl.load();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        const imagesWrap = modal.querySelector('.info-images') as HTMLElement | null;
        const videoWrap = modal.querySelector('.info-video') as HTMLElement | null;
        if (imagesWrap) imagesWrap.style.display = 'none';
        if (videoWrap) videoWrap.style.display = '';
        videoEl.play().catch(() => {});
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        if (videoEl) { videoEl.pause(); videoEl.currentTime = 0; }
    }

    document.addEventListener('click', (ev) => {
        const target = ev.target as HTMLElement | null;
        if (!target) return;
        const btn = target.closest('.info-btn') as HTMLElement | null;
        if (btn) {
            const type = btn.getAttribute('data-type');
            if (type === 'images') openImageModal(0);
            else if (type === 'video') openVideoModal();
            return;
        }

        const action = target.getAttribute('data-action');
        if (action === 'close') closeModal();
        if (target.classList.contains('img-next')) {
            currentImageIndex = (currentImageIndex + 1) % imageSet.length;
            if (imgEl) imgEl.src = imageSet[currentImageIndex];
        }
        if (target.classList.contains('img-prev')) {
            currentImageIndex = (currentImageIndex - 1 + imageSet.length) % imageSet.length;
            if (imgEl) imgEl.src = imageSet[currentImageIndex];
        }
    });

    // close modal on Escape
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') closeModal();
    });

});