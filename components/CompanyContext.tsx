"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Company = {
  id: string;
  name: string;
  createdAt: string;
};

type CompanyCtx = {
  companies: Company[];
  activeCompanyId: string | null;
  activeCompany: Company | null;
  loading: boolean;
  setActiveCompanyId: (id: string) => void;
  createCompany: (name: string) => Promise<Company>;
  deleteCompany: (id: string) => Promise<void>;
  renameCompany: (id: string, name: string) => Promise<void>;
};

const CompanyContext = createContext<CompanyCtx | null>(null);

const LS_KEY = "sma-active-company";

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data: Company[]) => {
        setCompanies(data);
        const stored = localStorage.getItem(LS_KEY);
        const valid = stored && data.find((c) => c.id === stored);
        setActiveCompanyIdState(valid ? stored : (data[0]?.id ?? null));
      })
      .finally(() => setLoading(false));
  }, []);

  const setActiveCompanyId = useCallback((id: string) => {
    setActiveCompanyIdState(id);
    localStorage.setItem(LS_KEY, id);
  }, []);

  const createCompany = useCallback(async (name: string): Promise<Company> => {
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create company");
    const company: Company = await res.json();
    setCompanies((prev) => [...prev, company]);
    setActiveCompanyId(company.id);
    return company;
  }, [setActiveCompanyId]);

  const deleteCompany = useCallback(async (id: string) => {
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    setCompanies((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeCompanyId === id) {
        const fallback = next[0]?.id ?? null;
        setActiveCompanyIdState(fallback);
        if (fallback) localStorage.setItem(LS_KEY, fallback);
      }
      return next;
    });
  }, [activeCompanyId]);

  const renameCompany = useCallback(async (id: string, name: string) => {
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;

  return (
    <CompanyContext.Provider
      value={{ companies, activeCompanyId, activeCompany, loading, setActiveCompanyId, createCompany, deleteCompany, renameCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
}
