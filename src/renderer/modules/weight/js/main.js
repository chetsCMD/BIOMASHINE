import { bm } from 'bm://app/sdk/bm.js';
import { WeightModule } from './WeightModule.js';

bm.ready.then(() => new WeightModule(bm, document).start());