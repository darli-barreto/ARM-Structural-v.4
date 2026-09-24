import type { BimAnyDocument } from '../../core/database/BimDatabaseTypes';

export type SelectByIdResult = {
  type: 'element' | 'grid' | 'level';
  doc: BimAnyDocument;
};
