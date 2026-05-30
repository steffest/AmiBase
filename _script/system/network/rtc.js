export async function waitForIceGathering(pc, maxMs) {
    return new Promise((resolve) => {
        const candidates = [];
        let done = false;
        let timeout = setTimeout(finish, maxMs || 3500);

        function finish() {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            pc.removeEventListener("icecandidate", onCandidate);
            pc.removeEventListener("icegatheringstatechange", onStateChange);
            resolve(candidates);
        }

        function onCandidate(ev) {
            if (ev.candidate) {
                candidates.push(ev.candidate.toJSON());
            } else {
                finish();
            }
        }

        function onStateChange() {
            if (pc.iceGatheringState === "complete") finish();
        }

        pc.addEventListener("icecandidate", onCandidate);
        pc.addEventListener("icegatheringstatechange", onStateChange);
        if (pc.iceGatheringState === "complete") finish();
    });
}

export async function addIceCandidates(pc, candidates) {
    if (!Array.isArray(candidates)) return;
    for (let i = 0; i < candidates.length; i += 1) {
        try {
            await pc.addIceCandidate(candidates[i]);
        } catch (_e) {}
    }
}

