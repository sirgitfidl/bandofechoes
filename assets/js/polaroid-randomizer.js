// Randomly assign polaroid images to collage positions on each page load.
// Assumptions:
// - Image files live in assets/images/band_photos/polaroids/ named polaroid_01.png .. polaroid_09.png
// - Collage markup contains <figure class="polaroid"> elements each with
//   .face.front img and .face.back img.
// - All currently point to a placeholder (polaroid_1.jpg) that we replace.
// - Back image should mirror the front (can be swapped later if distinct backs desired).
(() => {
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function init() {
        const figures = Array.from(document.querySelectorAll('.collage .polaroid'));
        if (!figures.length) return;
        const totalNeeded = figures.length;

        // Collect available image names (update here if you add/remove files)
        const baseDir = 'assets/images/band_photos/polaroids/';
        const available = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
            const num = String(n).padStart(2, '0');
            return { n, path: `${baseDir}polaroid_${num}.png` };
        });

        // Shuffle and slice (if fewer figures than images)
        const chosen = shuffle(available.slice()).slice(0, totalNeeded);

        // If there are more figures than images (unlikely), allow reuse by cycling
        while (chosen.length < totalNeeded) {
            chosen.push(...shuffle(available.slice()));
        }

        figures.forEach((fig, idx) => {
            const imgInfo = chosen[idx];
            const front = fig.querySelector('.face.front img');
            const back = fig.querySelector('.face.back img');
            if (front) {
                front.src = imgInfo.path;
                front.alt = `Band of Echoes — photo ${imgInfo.n}`;
                front.setAttribute('data-rand-src', imgInfo.path);
            }
            if (back) {
                back.src = imgInfo.path;
                back.alt = `Back of photo ${imgInfo.n}`; // Adjust if you later differentiate backs
                back.setAttribute('data-rand-src', imgInfo.path);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
