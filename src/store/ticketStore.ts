import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TicketPhoto = {
  id: string;
  file?: File;
  preview: string;
  address: string;
  phone: string;
  price: string;
  payment?: "E" | "T";
};

export type Route = {
  id: string;
  name: string;
  photos: TicketPhoto[];
  activeIndex: number;
};

export type RoutePatch = Partial<
  Pick<TicketPhoto, "address" | "phone" | "price" | "payment">
>;

type RoutesState = {
  routes: Route[];
  expandedId: string | null;
  addRoute: (route: Route) => void;
  removeRoute: (id: string) => void;
  setExpanded: (id: string | null) => void;
  addPhotos: (routeId: string, photos: TicketPhoto[]) => void;
  setActiveIndex: (routeId: string, index: number) => void;
  updateActive: (routeId: string, patch: RoutePatch) => void;
};

export const useRoutesStore = create<RoutesState>()(
  persist(
    (set) => ({
      routes: [],
      expandedId: null,
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
    }),
    {
      name: "ticket-transcriptions",
      merge: (persisted, current) => {
        const p = persisted as {
          routes?: Route[];
          expandedId?: string | null;
          photos?: TicketPhoto[];
          activeIndex?: number;
        };
        if (p && Array.isArray(p.photos)) {
          const legacy: Route = {
            id: "legacy",
            name: "Ruta 1",
            photos: p.photos as TicketPhoto[],
            activeIndex: p.activeIndex ?? 0,
          };
          return { ...current, routes: [legacy], expandedId: "legacy" };
        }
        return {
          ...current,
          ...(p?.routes ? { routes: p.routes, expandedId: p.expandedId } : {}),
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
            payment: p.payment,
          })),
        })),
        expandedId: state.expandedId,
      }),
    },
  ),
);