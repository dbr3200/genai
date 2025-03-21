import { TUserRole } from "../types";

export interface IAccount {
  UserId: string;
  EmailId: string;
  UserRole: TUserRole;
  Name?: string;
  EmailSubscription?: string;
  DefaultDomain?: string;
  LastModifiedBy?: string;
  AmorphicIntegrationStatus?: string;
  TenantName?: string;
  RoleId?: string;
  LastModified?: string;
  LastModifiedTime?: string;
  UserCreationDate?: string;
  Preferences: {darkMode: boolean};
}