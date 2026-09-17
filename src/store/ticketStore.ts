import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_MANUAL_QUOTAS,
  DEFAULT_MODEL,
  isModelId,
  type ModelId,
} from "@/lib/models";

export type TicketPhoto = {
  id: string;
  file?: File;
  preview: string;
  address: string;
  phone: string;
  price: string;
  total?: string;
  cash?: string;
  transfer?: string;
  width?: number;
  height?: number;
};

export type Route = {
  id: string;
  name: string;
  photos: TicketPhoto[];
  activeIndex: number;
};

export type RoutePatch = Partial<
  Pick<
    TicketPhoto,
    "address" | "phone" | "price" | "total" | "cash" | "transfer"
  >
>;

type RoutesState = {
  routes: Route[];
  expandedId: string | null;
  // Ajustes de prueba (tokens/versión)
  modelVersion: ModelId;
  overlayOpen: boolean;
  spentLocal: Partial<Record<ModelId, number>>;
  requestsCount: Partial<Record<ModelId, number>>;
  // acciones
  addRoute: (route: Route) => void;
  removeRoute: (id: string) => void;
  setExpanded: (id: string | null) => void;
  addPhotos: (routeId: string, photos: TicketPhoto[]) => void;
  removePhoto: (routeId: string, photoId: string) => void;
  setActiveIndex: (routeId: string, index: number) => void;
  updateActive: (routeId: string, patch: RoutePatch) => void;
  setModelVersion: (model: ModelId) => void;
  openTokenPanel: () => void;
  closeTokenPanel: () => void;
  resetSpent: (model?: ModelId) => void;
  recordUsage: (model: ModelId, total: number) => void;
};

export const useRoutesStore = create<RoutesState>()(
  persist(
    (set) => ({
      routes: [],
      expandedId: null,
      modelVersion: DEFAULT_MODEL,
      overlayOpen: false,
      spentLocal: {},
      requestsCount: {},
      addRoute: (route) =>
        set((state) => ({
          routes: [...state.routes, route],
          expandedId: route.id,
        })),
      removeRoute: (id) =>
        set((state) => ({
          routes: state.routes.filter((r) => r.id !== id),
          expandedId: state.expandedId === id ? null : state.expandedId,
        })),
      setExpanded: (id) => set({ expandedId: id }),
      addPhotos: (routeId, photos) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === routeId ? { ...r, photos: [...r.photos, ...photos] } : r,
          ),
        })),
      removePhoto: (routeId, photoId) =>
        set((state) => ({
          routes: state.routes.map((r) => {
            if (r.id !== routeId) return r;
            const photos = r.photos.filter((p) => p.id !== photoId);
            const activeIndex =
              r.activeIndex >= photos.length
                ? Math.max(0, photos.length - 1)
                : r.activeIndex;
            return { ...r, photos, activeIndex };
          }),
        })),
      setActiveIndex: (routeId, activeIndex) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === routeId ? { ...r, activeIndex } : r,
          ),
        })),
      updateActive: (routeId, patch) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === routeId
              ? {
                  ...r,
                  photos: r.photos.map((p, i) =>
                    i === r.activeIndex ? { ...p, ...patch } : p,
                  ),
                }
              : r,
          ),
        })),
      setModelVersion: (modelVersion) => set({ modelVersion }),
      openTokenPanel: () => set({ overlayOpen: true }),
      closeTokenPanel: () => set({ overlayOpen: false }),
      resetSpent: (model) =>
        set((state) => {
          if (model) {
            return {
              spentLocal: { ...state.spentLocal, [model]: 0 },
              requestsCount: { ...state.requestsCount, [model]: 0 },
            };
          }
          return { spentLocal: {}, requestsCount: {} };
        }),
      recordUsage: (model, total) =>
        set((state) => ({
          spentLocal: {
            ...state.spentLocal,
            [model]: (state.spentLocal[model] ?? 0) + Math.max(0, total),
          },
          requestsCount: {
            ...state.requestsCount,
            [model]: (state.requestsCount[model] ?? 0) + 1,
          },
        })),
    }),
    {
      name: "ticket-transcriptions",
      merge: (persisted, current) => {
        const p = persisted as Partial<RoutesState> & {
          photos?: TicketPhoto[];
          activeIndex?: number;
        };
        if (p && Array.isArray(p.photos)) {
          const legacy: Route = {
            id: "legacy",
            name: "Ruta 1",
            photos: (p.photos as TicketPhoto[]).map((photo) =>
              migratePayment(photo),
            ),
            activeIndex: p.activeIndex ?? 0,
          };
          return { ...current, routes: [legacy], expandedId: "legacy" };
        }
        return {
          ...current,
          ...(Array.isArray(p?.routes)
            ? {
                routes: p.routes.map((r) => ({
                  ...r,
                  photos: Array.isArray(r.photos)
                    ? r.photos.map(migratePayment)
                    : [],
                })),
                expandedId: p.expandedId ?? null,
              }
            : {}),
          ...(isModelId(p?.modelVersion) ? { modelVersion: p.modelVersion } : {}),
          ...(p?.spentLocal ? { spentLocal: p.spentLocal } : {}),
          ...(p?.requestsCount ? { requestsCount: p.requestsCount } : {}),
        };
      },
      partialize: (state) => ({
        routes: state.routes.map((r) => ({
          ...r,
          photos: r.photos.map((p) => ({
            id: p.id,
            preview: p.preview,
            address: p.address,
            phone: p.phone,
            price: p.price,
            total: p.total,
            cash: p.cash,
            transfer: p.transfer,
            width: p.width,
            height: p.height,
          })),
        })),
        expandedId: state.expandedId,
        modelVersion: state.modelVersion,
        spentLocal: state.spentLocal,
        requestsCount: state.requestsCount,
      }),
    },
  ),
);

const migratePayment = (photo: TicketPhoto): TicketPhoto => {
  const migrated = { ...photo };
  const payment = (photo as TicketPhoto & { payment?: "E" | "T" }).payment;
  if (payment === "E" && migrated.cash == null) {
    migrated.cash = migrated.price ?? "";
    migrated.transfer = "";
  } else if (payment === "T" && migrated.transfer == null) {
    migrated.cash = "";
    migrated.transfer = migrated.price ?? "";
  }
  delete (migrated as TicketPhoto & { payment?: unknown }).payment;
  return migrated;
};

export const getLimit = (s: RoutesState): number | null => {
  const limit = DEFAULT_MANUAL_QUOTAS[s.modelVersion];
  return limit > 0 ? limit : null;
};

export const getRemaining = (s: RoutesState): number | null => {
  const limit = DEFAULT_MANUAL_QUOTAS[s.modelVersion];
  if (limit <= 0) return null;
  return Math.max(0, limit - (s.spentLocal[s.modelVersion] ?? 0));
};