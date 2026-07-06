import { _decorator, AudioClip, AudioSource, Component, resources } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
    private static _instance: AudioManager | null = null;
    public static get instance(): AudioManager { return this._instance!; }

    @property(AudioSource)
    private source: AudioSource | null = null;

    private _clips: Map<string, AudioClip> = new Map();

    onLoad() {
        AudioManager._instance = this;
        if (!this.source) {
            this.source = this.node.addComponent(AudioSource);
        }
    }

    onDestroy() {
        if (AudioManager._instance === this) AudioManager._instance = null;
    }

    public preload(name: string, path: string) {
        if (this._clips.has(name)) return;
        resources.load(path, AudioClip, (err, clip) => {
            if (!err && clip) this._clips.set(name, clip);
        });
    }

    public play(name: string, volumeScale: number = 1.0) {
        const clip = this._clips.get(name);
        if (clip && this.source) {
            this.source.playOneShot(clip, volumeScale);
        }
    }
}
