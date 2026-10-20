export function initializeTierCollapsibles() {
    document.querySelectorAll(".tier .tier-header").forEach((hdr) => {
        const header = hdr;
        const tierEl = header.closest(".tier");
        if (tierEl && tierEl.id === "options") {
            header.tabIndex = -1;
            header.setAttribute("aria-expanded", "true");
            return;
        }
        header.tabIndex = 0;
        header.setAttribute("role", "button");
        header.setAttribute("aria-expanded", "true");
        const toggle = () => {
            const tier = header.closest(".tier");
            if (!tier)
                return;
            const collapsed = tier.classList.toggle("collapsed");
            header.setAttribute("aria-expanded", String(!collapsed));
        };
        header.addEventListener("click", (ev) => {
            const target = ev.target;
            if (target && target.closest("select")) {
                return;
            }
            toggle();
        });
        header.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                toggle();
            }
        });
    });
    const initialCollapsedIds = [
        "tier-t5", "tier-t6", "tier-t7",
        "join-tier-t5", "join-tier-t6", "join-tier-t7",
        "host-tier-t5", "host-tier-t6", "host-tier-t7"
    ];
    initialCollapsedIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el)
            return;
        el.classList.add("collapsed");
        const hdr = el.querySelector(".tier-header");
        if (hdr) {
            hdr.setAttribute("aria-expanded", "false");
        }
    });
}
