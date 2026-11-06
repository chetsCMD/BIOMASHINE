import { bm } from 'bm://app/sdk/bm.js';
import { NutritionModule } from './NutritionModule.js';

bm.ready.then(() => new NutritionModule(bm, document, window.Chart).start());