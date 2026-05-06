import { act, createElement, useEffect, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

import { installMinimalDom, uninstallMinimalDom } from "./minimal-dom";

export function createReactControllerHarness() {
  installMinimalDom();

  const container = document.createElement("div");
  const root = createRoot(container);

  return {
    container,
    async cleanup() {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      uninstallMinimalDom();
    },
    async render(element: ReactElement) {
      await act(async () => {
        root.render(element);
        await Promise.resolve();
      });
    }
  };
}

export function createControllerProbe<TProps extends object, TController>(
  useController: (props: TProps) => TController
) {
  let latestController: TController | null = null;

  function Probe(props: TProps) {
    const controller = useController(props);

    useEffect(() => {
      latestController = controller;
    }, [controller]);

    return null;
  }

  return {
    controller() {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    },
    element(props: TProps) {
      return createElement(Probe, props);
    }
  };
}
