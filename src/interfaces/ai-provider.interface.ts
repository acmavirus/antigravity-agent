import { Account } from './account.interface';
import { ModelQuota } from './quota.interface';

export interface IAiProvider {
    getQuota(account: Account): Promise<ModelQuota[]>;
}
