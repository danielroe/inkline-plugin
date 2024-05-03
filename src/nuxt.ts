import { readFileSync } from 'node:fs'
import { template } from 'lodash-es'
import {
    defineNuxtModule,
    addPluginTemplate,
    addComponentsDir,
} from "@nuxt/kit";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { InklinePluginOptions } from "@inkline/inkline";
import { NuxtModule } from "@nuxt/schema";
import { UserOptions } from "./plugin/types";
import { watch } from "./plugin/watch";
import { build } from "./plugin/build";
import { getResolvedOptions } from "@inkline/config";

interface ModuleConfig {
    import?: {
        mode?: "global" | "auto";
        styles?: boolean;
        scripts?: boolean;
        utilities?: boolean;
    };
}

const defaultImportOptions: ModuleConfig["import"] = {
    mode: "auto",
    styles: true,
    scripts: true,
    utilities: true,
};

export type InklineModule = {
    globals: Partial<InklinePluginOptions>;
} & ModuleConfig &
    UserOptions;

export const module: NuxtModule<InklineModule> = defineNuxtModule({
    meta: {
        name: "@inkline/nuxt",
        version: "3",
        configKey: "inkline",
        compatibility: {
            nuxt: ">=2.0.0",
            bridge: true,
        },
    },
    async setup(
        { import: importOptions, configFile, outputDir, extName, globals },
        nuxt
    ) {
        importOptions = {
            ...defaultImportOptions,
            ...importOptions,
        };

        const pluginOptions: UserOptions = {
            configFile,
            outputDir,
            extName,
        };
        const resolvedPluginOptions = getResolvedOptions(pluginOptions);

        const templatesDir = fileURLToPath(
            new URL("./templates", import.meta.url)
        );
        const inklineRequire = createRequire(import.meta.url);

        // Add CSS imports
        if (importOptions.styles !== false) {
            nuxt.options.css = nuxt.options.css || [];

            nuxt.options.css.unshift(
                `${resolvedPluginOptions.outputDir}/index.scss`
            );
            nuxt.options.css.unshift("@inkline/inkline/css/index.scss");

            if (importOptions.utilities !== false) {
                nuxt.options.css.push("@inkline/inkline/css/utilities.scss");
            }
        }

        // Add to transpile
        nuxt.options.build.transpile.push("@inkline/inkline");

        if (importOptions.scripts !== false) {
            // Add plugin template
            addPluginTemplate({
                mode: "all",
                getContents({ options }) {
                  const contents = readFileSync(resolve(templatesDir, "nuxt.ejs"), "utf-8")
                  return template(contents)({ options })
                },
                write: true,
                filename: "inkline.mjs",
                options: globals || {},
            });
        }

        // Add dynamic component imports
        await addComponentsDir({
            path: join(
                dirname(inklineRequire.resolve("@inkline/inkline")),
                "components"
            ),
            pathPrefix: false,
            pattern: "**/*.vue",
            ignore: ["**/examples/*.vue"],
            transpile: true,
            global: importOptions.mode === "global",
        });

        if (nuxt.options.dev) {
            watch(pluginOptions);
        } else {
            build(pluginOptions);
        }
    },
});

export default module;
