import { bm } from 'bm://app/sdk/bm.js';
import { TrainingModule } from './TrainingModule.js';

bm.ready.then(() => new TrainingModule(bm, document, window.Chart).start());