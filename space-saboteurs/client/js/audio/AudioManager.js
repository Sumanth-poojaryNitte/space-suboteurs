export class AudioManager {
  constructor() {
    this.backgroundMusic = new Audio("/asset/background.mp3");
    this.killSound = new Audio("/asset/kill.mp3");

    this.backgroundMusic.loop = true;

    this.backgroundMusic.volume = 0.25;
    this.killSound.volume = 0.8;

    this.started = false;
  }

  startBackgroundMusic() {
    if (this.started) {
      return;
    }

    this.backgroundMusic
      .play()
      .then(() => {
        this.started = true;
      })
      .catch(() => {
        // Browser may block autoplay until user interacts.
      });
  }

  playKillSound() {
    this.killSound.currentTime = 0;

    this.killSound
      .play()
      .catch(() => {
        // Ignore browser autoplay restrictions.
      });
  }

  stopBackgroundMusic() {
    this.backgroundMusic.pause();
    this.backgroundMusic.currentTime = 0;
    this.started = false;
  }
}