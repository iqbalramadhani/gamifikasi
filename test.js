const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><html><body><script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><script>
window.onload = function() {
    window.playerBladeMat = new THREE.MeshLambertMaterial({color: 0xeeeeee});
    try {
        if (typeof playerBladeMat !== 'undefined') {
            playerBladeMat.color.setHex(0xff0000);
            console.log("SUCCESS:", playerBladeMat.color.getHex());
        }
    } catch (e) {
        console.error("ERROR:", e);
    }
}
</script></body></html>`, { runScripts: "dangerously", resources: "usable" });
