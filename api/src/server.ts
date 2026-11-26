import { createApp } from './app.js';
import { env } from './config/env.js';

createApp().listen(env.PORT, () => {
  console.log(`CrateDig API listening on http://localhost:${env.PORT}/api/v1`);
});
