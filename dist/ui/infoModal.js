export function initializeInfoModal() {
    const modal = document.getElementById("info-modal");
    const imgEl = document.getElementById("info-image");
    const videoEl = document.getElementById("info-video");
    const imageSet = [
        "res/TotalTroops.png",
        "res/squad.png",
        "res/TotalTroopsCalc.png",
        "res/FormationsCalc.png"
    ];
    const videoSrc = "res/FormationsVid.mp4";
    let currentImageIndex = 0;
    function openImageModal(startIndex = 0) {
        if (!modal || !imgEl)
            return;
        currentImageIndex = startIndex % imageSet.length;
        imgEl.src = imageSet[currentImageIndex];
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        const imagesWrap = modal.querySelector(".info-images");
        const videoWrap = modal.querySelector(".info-video");
        if (imagesWrap)
            imagesWrap.style.display = "";
        if (videoWrap)
            videoWrap.style.display = "none";
        if (videoEl) {
            videoEl.pause();
            videoEl.currentTime = 0;
        }
    }
    function openVideoModal() {
        if (!modal || !videoEl)
            return;
        const srcEl = document.getElementById("info-video-src");
        if (srcEl)
            srcEl.src = videoSrc;
        videoEl.load();
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        const imagesWrap = modal.querySelector(".info-images");
        const videoWrap = modal.querySelector(".info-video");
        if (imagesWrap)
            imagesWrap.style.display = "none";
        if (videoWrap)
            videoWrap.style.display = "";
        videoEl.play().catch(() => { });
    }
    function closeModal() {
        if (!modal)
            return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        if (videoEl) {
            videoEl.pause();
            videoEl.currentTime = 0;
        }
    }
    document.addEventListener("click", (ev) => {
        const target = ev.target;
        if (!target)
            return;
        const btn = target.closest(".info-btn");
        if (btn) {
            const type = btn.getAttribute("data-type");
            if (type === "images")
                openImageModal(0);
            else if (type === "video")
                openVideoModal();
            return;
        }
        const action = target.getAttribute("data-action");
        if (action === "close")
            closeModal();
        if (target.classList.contains("img-next")) {
            currentImageIndex = (currentImageIndex + 1) % imageSet.length;
            if (imgEl)
                imgEl.src = imageSet[currentImageIndex];
        }
        if (target.classList.contains("img-prev")) {
            currentImageIndex = (currentImageIndex - 1 + imageSet.length) % imageSet.length;
            if (imgEl)
                imgEl.src = imageSet[currentImageIndex];
        }
    });
    document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
            closeModal();
        }
    });
}
