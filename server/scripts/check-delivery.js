// Read-only: never books, cancels or schedules a parcel.
import { config, serviceability } from '../src/delhivery.js';

const settings = {
  courierToken: config.configured,
  courierEnvironment: config.env,
  pickupLocation: Boolean(config.pickupLocation),
  webhookSecret: config.webhookReady,
  persistentDataDirectory: Boolean(process.env.DATA_DIR),
  productionRuntime: process.env.NODE_ENV === 'production',
  frontendOriginConfigured: Boolean(process.env.CLIENT_ORIGIN),
  r2Required: process.env.R2_REQUIRED === 'true',
};
console.log(JSON.stringify(settings, null, 2));
if (!config.configured) {
  console.error('Delhivery token is missing.');
  process.exitCode = 1;
} else {
  try {
    const result = await serviceability(process.env.DELIVERY_TEST_PIN || '700001');
    console.log('Live read-only PIN check:', JSON.stringify(result));
  } catch (err) {
    console.error('Courier check failed:', err.message);
    process.exitCode = 1;
  }
}
console.log('Booking, warehouse acceptance and public webhook delivery require a separate acceptance test after deployment.');
