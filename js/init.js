window.onload = () => {
    // Tampilkan Main Menu
    document.getElementById("main-menu").style.display = "flex";
};

window.startGame = () => {
    if (isGameStarted) return;
    isGameStarted = true;
    document.getElementById("main-menu").style.display = "none";
    
    initSetup();
    initHometown();
    initMap();
    initEntities();
    initNPCs();
    
    // Play BGM
    playSound('bgm');
    window.bgmStarted = true;
    
    gameLoop();
};

window.togglePause = () => {
    if (!isGameStarted || gameOver) return;
    isPaused = !isPaused;
    document.getElementById("pause-menu").style.display = isPaused ? "flex" : "none";
    if (!isPaused) {
       // Melanjutkan putaran jika di-unpause
       gameLoop();
    }
};
