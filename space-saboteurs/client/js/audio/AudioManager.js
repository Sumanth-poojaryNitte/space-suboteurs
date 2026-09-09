export class AudioManager {
  constructor() {
    this.backgroundMusic = new Audio("/asset/background.mp3");
    this.killSound = new Audio("/asset/kill.mp3");
    this.meetingBuzzer = new Audio("/asset/buzzer.mp3");

    // Background music
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.25;

    // Kill sound
    this.killSound.volume = 0.8;

    // Meeting buzzer
    this.meetingBuzzer.loop = true;
    this.meetingBuzzer.volume = 0.9;

    this.started = false;
    this.meetingBuzzerPlaying = false;
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

  startMeetingBuzzer() {
    if (this.meetingBuzzerPlaying) {
      return;
    }

    this.meetingBuzzer.currentTime = 0;

    this.meetingBuzzer
      .play()
      .then(() => {
        this.meetingBuzzerPlaying = true;
      })
      .catch(() => {
        // Ignore browser autoplay restrictions.
      });
  }

  stopMeetingBuzzer() {
    this.meetingBuzzer.pause();
    this.meetingBuzzer.currentTime = 0;
    this.meetingBuzzerPlaying = false;
  }

  stopBackgroundMusic() {
    this.backgroundMusic.pause();
    this.backgroundMusic.currentTime = 0;
    this.started = false;
  }

  stopAllSounds() {
    this.stopMeetingBuzzer();
    this.stopBackgroundMusic();

    this.killSound.pause();
    this.killSound.currentTime = 0;
  }
}