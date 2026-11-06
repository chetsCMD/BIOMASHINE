export class ReactionTest {
    constructor({ config, listener, random = () => Math.random(), now = () => performance.now(), setTimer = (work, delay) => setTimeout(work, delay), clearTimer = (id) => clearTimeout(id) }) {
        this.config = config;
        this.listener = listener;
        this.random = random;
        this.now = now;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.timers = new Set();
        this.reset();
    }

    reset() {
        this.cancelTimers();
        this.stage = 0;
        this.values = [];
        this.active = false;
        this.waiting = false;
        this.go = false;
        this.locked = false;
        this.startedAt = 0;
        this.listener.onState({ state: 'ready', text: { key: 'test.startPrompt' }, sub: this.stageLabel(0) });
        this.listener.onReset();
    }

    stageLabel(stage) {
        return { key: 'test.stage', params: { stage, total: this.config.stages } };
    }

    cancelTimers() {
        this.timers.forEach((timer) => this.clearTimer(timer));
        this.timers.clear();
    }

    later(delay, work) {
        const timer = this.setTimer(() => {
            this.timers.delete(timer);
            work();
        }, delay);
        this.timers.add(timer);
    }

    start() {
        if (this.active) {
            return;
        }
        this.reset();
        this.active = true;
        this.nextStage();
    }

    abort() {
        this.reset();
    }

    nextStage() {
        this.stage += 1;
        if (this.stage > this.config.stages) {
            this.finish();
            return;
        }
        this.waiting = false;
        this.go = false;
        this.locked = false;
        this.listener.onState({ state: 'ready', text: { key: 'test.stagePrompt', params: { stage: this.stage } }, sub: this.stageLabel(this.stage) });
    }

    press() {
        if (this.locked) {
            return;
        }
        if (!this.active) {
            this.start();
        } else if (this.waiting) {
            this.fail();
        } else if (this.go) {
            this.succeed();
        } else if (this.stage > 0 && this.stage <= this.config.stages) {
            this.wait();
        }
    }

    wait() {
        this.waiting = true;
        this.go = false;
        this.listener.onState({ state: 'waiting', text: { key: 'test.wait' }, sub: this.stageLabel(this.stage) });
        const span = this.config.waitMaxMs - this.config.waitMinMs;
        this.later(Math.floor(this.random() * span) + this.config.waitMinMs, () => {
            this.waiting = false;
            this.go = true;
            this.startedAt = this.now();
            this.listener.onState({ state: 'go', text: { key: 'test.go' }, sub: this.stageLabel(this.stage) });
        });
    }

    fail() {
        this.cancelTimers();
        this.waiting = false;
        this.go = false;
        this.locked = true;
        this.listener.onState({ state: 'fail', text: { key: 'test.fail' }, sub: this.stageLabel(this.stage) });
        this.later(this.config.failDelayMs, () => this.nextStage());
    }

    succeed() {
        const reaction = Math.round(this.now() - this.startedAt);
        this.values.push(reaction);
        this.go = false;
        this.locked = true;
        this.listener.onState({ state: 'ready', text: { key: 'test.success', params: { ms: reaction } }, sub: this.stageLabel(this.stage) });
        this.later(this.config.successDelayMs, () => this.nextStage());
    }

    finish() {
        this.active = false;
        const average = Math.round(this.values.reduce((sum, value) => sum + value, 0) / (this.values.length || 1));
        this.listener.onState({ state: 'ready', text: { key: 'test.done' }, sub: { key: 'test.doneAverage', params: { average } } });
        this.listener.onFinish({ values: [...this.values], average, complete: this.values.length === this.config.stages });
    }
}
