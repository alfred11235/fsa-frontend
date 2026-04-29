import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userControlApi } from '@fsa/shared-api';
import { useAuth, MembershipInfo } from './AuthProvider';

interface CategoryInfo {
  id: number;
  code: string;
  description: string;
  iconUrl: string | null;
}

interface MunicipalityBounds {
  centerLatitude: number;
  centerLongitude: number;
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

interface ContractOption {
  id: number;
  name: string;
  roleId: number;
  roleName: string;
  permissions: string[];
  membershipId: number;
  municipalityId: number | null;
  categories: CategoryInfo[];
  bounds: MunicipalityBounds | null;
}

interface ContractContextType {
  contracts: ContractOption[];
  selectedContract: ContractOption | null;
  setSelectedContractId: (id: number) => void;
  loading: boolean;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export function useContract() {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error('useContract must be used within ContractProvider');
  return ctx;
}

const SERVICE_MENU_ROLES = ['Admin', 'AdminSystem', 'AdminEntity', 'Supervisor', 'Agent'];
const SERVICE_ORDER_MENU_ROLES = ['Admin', 'AdminSystem', 'AdminEntity', 'Supervisor'];

export function canSeeServiceMenu(contract: ContractOption | null): boolean {
  if (!contract) return false;
  return SERVICE_MENU_ROLES.includes(contract.roleName);
}

export function canSeeServiceOrderMenu(contract: ContractOption | null): boolean {
  if (!contract) return false;
  return SERVICE_ORDER_MENU_ROLES.includes(contract.roleName);
}

export function ContractProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractOption | null>(null);
  const [loading, setLoading] = useState(true);

  // Build contracts from JWT memberships, then fetch categories per contract via API
  useEffect(() => {
    if (!user || !isAuthenticated) {
      setContracts([]);
      setSelectedContract(null);
      setLoading(false);
      return;
    }

    const membershipsWithContract = user.memberships.filter(
      (m) => m.contractId !== null && m.contractName !== null
    );

    if (membershipsWithContract.length === 0) {
      setContracts([]);
      setSelectedContract(null);
      setLoading(false);
      return;
    }

    // Build contract options from JWT data (roles/permissions available immediately)
    const contractOptions: ContractOption[] = membershipsWithContract.map((m) => ({
      id: m.contractId!,
      name: m.contractName!,
      roleId: m.roleId,
      roleName: m.roleName,
      permissions: m.permissions,
      membershipId: m.membershipId,
      municipalityId: m.municipalityId,
      categories: [], // will be loaded from API
      bounds: null, // will be loaded from API
    }));

    setContracts(contractOptions);
    setSelectedContract(contractOptions[0]);

    // Fetch categories and bounds for each contract in the background
    const loadContractData = async () => {
      try {
        const contractIds = contractOptions.map((c) => c.id);
        // Fetch contracts (categories) and bounds in parallel
        const [contractResults, boundsResults] = await Promise.all([
          Promise.all(contractIds.map((id) => userControlApi.getContract(id).catch(() => null))),
          Promise.all(contractIds.map((id) => userControlApi.getContractBounds(id).catch(() => null))),
        ]);

        setContracts((prev) =>
          prev.map((c, i) => {
            const contractData = contractResults[i]?.data;
            const boundsData = boundsResults[i]?.data as MunicipalityBounds | null;
            return {
              ...c,
              categories: contractData?.categories ?? c.categories,
              bounds: boundsData ?? c.bounds,
            };
          })
        );

        // Update selected contract too
        setSelectedContract((prev) => {
          if (!prev) return prev;
          const idx = contractOptions.findIndex((c) => c.id === prev.id);
          const contractData = idx >= 0 ? contractResults[idx]?.data : null;
          const boundsData = idx >= 0 ? (boundsResults[idx]?.data as MunicipalityBounds | null) : null;
          return {
            ...prev,
            categories: contractData?.categories ?? prev.categories,
            bounds: boundsData ?? prev.bounds,
          };
        });
      } catch {
        // Categories/bounds will remain empty
      } finally {
        setLoading(false);
      }
    };

    loadContractData();
  }, [user, isAuthenticated]);

  const setSelectedContractId = useCallback(
    (id: number) => {
      const found = contracts.find((c) => c.id === id);
      if (found) setSelectedContract(found);
    },
    [contracts]
  );

  return (
    <ContractContext.Provider
      value={{ contracts, selectedContract, setSelectedContractId, loading }}
    >
      {children}
    </ContractContext.Provider>
  );
}
