import { bm } from 'bm://app/sdk/bm.js';
import { SleepModule } from './SleepModule.js';

bm.ready.then(() => new SleepModule(bm, document).start());