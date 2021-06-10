const fs = require("fs")
const path = require("path")
const parser = require("@babel/parser")   //  代码转换成 AST
const traverse = require("@babel/traverse").default   //  
const babel = require("@babel/core")

let ID = 0;

function createAsset(filename) {
  const content = fs.readFileSync(filename, "utf-8")

  const ast = parser.parse(content, {
    sourceType: "module"  //  不识别 import 语法，需要通过该配置处理
  })

  let dependencies = []   //  搜集某个文件都依赖了哪些文件 ["./info.js"]

  // visitor
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value)
    }
  })

  const { code: es5code } = babel.transformFromAstSync(ast, null, {
    presets: ["@babel/preset-env"]
  })

  let id = ID++

  return {
    id,
    filename,
    es5code,
    dependencies
  }
}

function createGraph(entry) {
  const mainAsset = createAsset(entry)

  const queue = [mainAsset]

  for (const asset of queue) {

    const dirname = path.dirname(asset.filename)

    asset.mapping = {}

    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath)
      const child = createAsset(absolutePath)

      asset.mapping[relativePath] = child.id

      queue.push(child)
    })
  }
  return queue
}

function bundle(graph) {
  let modules = "";
  graph.forEach(item => {
    modules += `
      ${item.id}: [
        function(require, module, exports) {
          ${item.es5code}
        },
        ${JSON.stringify(item.mapping)}
      ],
    `
  })
  const result = `
    (function(modules) {
      function require(id){
        const [fn, mapping] = modules[id];

        function localRequire(relativePath) {
          return require(mapping[relativePath])
        }

        const module = {
          exports: {}
        }

        fn(localRequire, module, module.exports)

        return module.exports
      }

      require(0);
    })({${modules}})
  `
  return result
}

const graph = createGraph('./src/index.js')
const result = bundle(graph)

const bundlePath = path.resolve(__dirname, '../dist/bundle.js')


// 打包扔到 bundlePath 下
fs.writeFile(bundlePath, result, err => {
  if (err) {

  } else {
    console.log(`打包完成，文件生成在【${bundlePath}】`)
  }
})
