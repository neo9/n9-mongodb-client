import * as mongodb from 'mongodb';

// eslint-disable-next-line import/no-extraneous-dependencies
export { ObjectId } from 'bson';

export default { ...mongodb };

export * from './client';
export * from './lang-utils';
export * from './lock-fields-manager';
export * from './lock';
export * from './models';
export * from './mongo-read-stream';
export * from './mongo-utils';
export * from './aggregation-utils';
export * from './n9-find-cursor';
