import { Configuration } from 'webpack'
import config from './module-federation.config'
import { withModuleFederation } from '@nx/module-federation/angular'
import { ModifySourcePlugin, ReplaceOperation } from 'modify-source-webpack-plugin'

const modifyPrimeNgPlugin = new ModifySourcePlugin({
  rules: [
    {
      test: (module) => {
        if (module.resource) {
          return module.resource.includes('primeng')
        }
        return false
      },
      operations: [
        new ReplaceOperation(
          'all',
          'document\\.createElement\\(',
          'document.createElementFromPrimeNg({"this": this, "arguments": Array.from(arguments)},'
        ),
        new ReplaceOperation('all', 'Theme.setLoadedStyleName', '(function(_){})')
      ]
    }
  ]
})

const modifyMaterialPlugin = new ModifySourcePlugin({
  rules: [
    {
      test: (module) => {
        if (module.resource) {
          return module.resource.includes('@angular/material') || module.resource.includes('@angular/cdk')
        }
        return false
      },
      operations: [
        new ReplaceOperation(
          'all',
          'document\\.createElement\\(',
          'document.createElementFromMaterial({"this": this, "arguments": Array.from(arguments)},'
        )
      ]
    }
  ]
})

export default async function (baseConfig: Configuration) {
  const withMf = await withModuleFederation(config, {
    shareScope: 'default'
  })
  const webpackConfig = withMf(baseConfig)

  return {
    ...webpackConfig,
    devtool: 'source-map',
    plugins: [...(webpackConfig.plugins ?? []), modifyPrimeNgPlugin, modifyMaterialPlugin],
    output: {
      ...webpackConfig.output,
      publicPath: 'auto',
      devtoolNamespace: 'onecx-chat-ui',
      uniqueName: 'onecx-chat-ui'
    },
    module: {
      ...webpackConfig.module,
      parser: {
        ...webpackConfig.module?.parser,
        javascript: { ...webpackConfig.module?.parser?.javascript, importMeta: false }
      }
    },
    experiments: {
      ...webpackConfig.experiments,
      topLevelAwait: true
    },
    optimization: {
      ...webpackConfig.optimization,
      runtimeChunk: false,
      splitChunks: false
    }
  }
}
