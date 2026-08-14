import awesomeCatalog from "./awesome-catalog.generated.json" with { type: "json" };

export const curatedPackages = [
  {
    slug: "dsh-web-ui",
    name: "dsh-web-ui",
    description: "Task board, Git graph, mobile remote, skins, and Web UI refinements.",
    descriptionZh: "任务看板、Git 图谱、移动遥控、皮肤和 Web UI 增强。",
    longDescription: "A plugin and skin collection for the DSH Web UI, including a task board, Git graph, right-side workspace, mobile remote control, live token stats, and a skin center.",
    longDescriptionZh: "面向 DSH Web UI 的插件与皮肤合集，包含任务看板、Git 图谱、侧边工作区、移动遥控、实时 token 统计和皮肤中心。",
    owner: "zhu1090093659",
    repo: "zhu1090093659/dsh-web-ui",
    type: "Interface",
    icon: "interface",
    color: "#1769e0",
    compatibility: "DSH rc.6",
    revision: "community check",
    revisionZh: "社区检查",
    commit: "main · mutable source",
    commitZh: "main · 可变来源",
    command: "dsh plugin --profile web add github:zhu1090093659/dsh-web-ui",
    testedPlatforms: [],
    sourceKind: "curated",
    stars: 1679,
    order: 1,
  },
  {
    slug: "dsh-vision-toolkit",
    name: "dsh-vision-toolkit",
    description: "Image Q&A, long-screenshot OCR, UI restoration, grounding, and pixel diff.",
    descriptionZh: "图像问答、长截图 OCR、界面还原、视觉定位和像素对比。",
    longDescription: "A DSH-native integration for agent-vision-toolkit with image question answering, OCR for long screenshots, visual grounding, UI restoration, pixel comparison, artifacts, and Web UI support.",
    longDescriptionZh: "agent-vision-toolkit 的 DSH 原生集成，支持图像问答、长截图 OCR、视觉定位、界面还原、像素对比、制品输出和 Web UI。",
    owner: "Anionex",
    repo: "Anionex/dsh-vision-toolkit",
    type: "Tool",
    icon: "vision",
    color: "#7839b7",
    compatibility: "DSH rc.6",
    revision: "community check",
    revisionZh: "社区检查",
    commit: "main · pin before install",
    commitZh: "main · 安装前应固定 commit",
    command: "dsh plugin --profile web add github:Anionex/dsh-vision-toolkit",
    testedPlatforms: [],
    sourceKind: "curated",
    stars: 298,
    order: 2,
  },
  {
    slug: "dsh-better-sidebar",
    name: "DSH-better-sidebar",
    description: "A complete side workspace with files, terminal, Git, and sub-agents.",
    descriptionZh: "集文件、终端、Git 和子智能体于一体的完整侧边工作区。",
    longDescription: "A full DSH sidebar workbench that supports third-party tab registration and includes file rendering and editing, an embedded terminal, Git controls, and sub-agent views.",
    longDescriptionZh: "完整的 DSH 侧边栏工作台，支持第三方标签页注册，并提供文件渲染与编辑、内嵌终端、Git 控制和子智能体视图。",
    owner: "omdsh-dev",
    repo: "omdsh-dev/DSH-better-sidebar",
    type: "Interface",
    icon: "workspace",
    color: "#07847e",
    compatibility: "DSH main",
    revision: "unconfirmed",
    revisionZh: "未确认",
    commit: "main · mutable source",
    commitZh: "main · 可变来源",
    command: "dsh plugin --profile web add github:omdsh-dev/DSH-better-sidebar",
    testedPlatforms: [],
    sourceKind: "curated",
    stars: 653,
    order: 3,
  },
  {
    slug: "dsh-tui",
    name: "dsh-TUI",
    description: "A full-screen terminal interface inspired by modern coding agents.",
    descriptionZh: "受现代编程智能体启发的全屏终端界面。",
    longDescription: "A terminal-first DSH interface with streaming reasoning, escape-to-rollback, context progress, TPS instrumentation, and a keyboard-focused interaction model.",
    longDescriptionZh: "以终端为核心的 DSH 界面，支持流式推理、Esc 回滚、上下文进度、TPS 指标和键盘优先交互。",
    owner: "ccch1mneyyy",
    repo: "ccch1mneyyy/dsh-TUI",
    type: "TUI",
    icon: "terminal",
    color: "#e05b16",
    compatibility: "DSH rc.6",
    revision: "npm 0.1.3",
    commit: "npm sha512-f+C7…iZ6Ng==",
    command: "dsh plugin --profile tui add dsh-cc-tui@0.1.3",
    testedPlatforms: ["macOS"],
    sourceKind: "curated",
    stars: 790,
    order: 4,
  },
  {
    slug: "dsh-deep-whale",
    name: "dsh-deep-whale",
    description: "A DeepSeek Harness Web UI skin collection with a deep-sea workshop theme.",
    descriptionZh: "以深海工坊为主题的 DeepSeek Harness Web UI 皮肤合集。",
    longDescription: "A community skin series for the DSH Web UI with a deep-sea visual system and a deliberately expressive interface theme.",
    longDescriptionZh: "面向 DSH Web UI 的社区皮肤系列，采用深海视觉体系和更具表现力的界面主题。",
    owner: "Small-tailqwq",
    repo: "Small-tailqwq/dsh-deep-whale",
    type: "Skin",
    icon: "skin",
    color: "#7e4acb",
    compatibility: "DSH Web",
    revision: "unconfirmed",
    revisionZh: "未确认",
    commit: "main · mutable source",
    commitZh: "main · 可变来源",
    command: "dsh plugin --profile web add github:Small-tailqwq/dsh-deep-whale",
    testedPlatforms: [],
    sourceKind: "curated",
    stars: 500,
    order: 5,
  },
  {
    slug: "colleague-skill",
    name: "colleague-skill",
    description: "A conversational digital-life skill package for DSH and agent environments.",
    descriptionZh: "面向 DSH 和智能体环境的对话式数字生活技能包。",
    longDescription: "A community-authored agent skill distributed through a dedicated skill branch and tagged for the DSH ecosystem.",
    longDescriptionZh: "由社区编写、通过专用 skill 分支分发，并为 DSH 生态标记的智能体技能。",
    owner: "titanwings",
    repo: "titanwings/colleague-skill",
    type: "Skill",
    icon: "skill",
    color: "#0e887c",
    compatibility: "DSH skills",
    revision: "branch: dot-skill",
    revisionZh: "分支：dot-skill",
    commit: "dot-skill · mutable branch",
    commitZh: "dot-skill · 可变分支",
    command: "dsh plugin --profile web add github:titanwings/colleague-skill#dot-skill",
    testedPlatforms: [],
    sourceKind: "curated",
    stars: 21901,
    order: 6,
  },
];

const catalogStyle = {
  Plugin: { icon: "plugin", color: "#245fcb" },
  Skill: { icon: "skill", color: "#0e887c" },
  Bundle: { icon: "bundle", color: "#7345bd" },
  Channel: { icon: "channel", color: "#b15d12" },
  Infrastructure: { icon: "infrastructure", color: "#526176" },
  Community: { icon: "community", color: "#147b70" },
  Research: { icon: "research", color: "#7e4acb" },
  Other: { icon: "plugin", color: "#526176" },
};

const curatedNames = new Set(curatedPackages.map((item) => item.name.toLowerCase()));
const curatedRepos = new Set(curatedPackages.map((item) => item.repo.toLowerCase()));
const sourceRevision = awesomeCatalog.meta.sourceRevision.slice(0, 7);

function createTopicPackages(githubTopicCatalog) {
  return githubTopicCatalog.plugins
    .filter((item) => !curatedRepos.has(item.repo.toLowerCase()))
    .map((item, index) => {
      const style = catalogStyle.Bundle;
      return {
        slug: `github-${item.repo}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        name: item.name,
        description: item.description,
        longDescription: "",
        version: item.version,
        owner: item.repo.split("/")[0],
        repo: item.repo,
        type: "Bundle",
        icon: style.icon,
        color: style.color,
        compatibility: "DSH bundle",
        revision: item.version || "bundle manifest",
        commit: item.headSha.slice(0, 7),
        command: `dsh plugin --profile community add github:${item.repo}#${item.headSha}`,
        installable: true,
        testedPlatforms: [],
        sourceKind: "github-topic",
        sourceUrl: `https://github.com/${item.repo}`,
        stars: item.stars,
        forks: item.forks,
        language: item.language,
        license: item.license,
        topics: item.topics,
        bundlePatch: item.bundlePatch,
        lifecycleScripts: item.lifecycleScripts,
        pushedAt: item.pushedAt,
        headSha: item.headSha,
        order: 500 + index,
      };
    });
}

const discoveredPackages = awesomeCatalog.plugins
  .filter((item) => !curatedNames.has(item.name.toLowerCase())
    && !curatedRepos.has(item.repo.toLowerCase()))
  .map((item, index) => {
    const style = catalogStyle[item.category] ?? catalogStyle.Other;
    return {
      slug: `awesome-${item.owner}-${item.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      name: item.name,
      description: item.description,
      longDescription: "",
      owner: item.owner,
      repo: item.repo,
      type: item.category,
      icon: style.icon,
      color: style.color,
      compatibility: "",
      revision: "",
      commit: sourceRevision,
      command: "",
      installable: false,
      testedPlatforms: [],
      sourceKind: "awesome",
      sourceUrl: awesomeCatalog.meta.sourceUrl,
      stars: 0,
      order: 2000 + index,
    };
  });

function withSearchText(item) {
  return {
    ...item,
    searchText: [
      item.name,
      item.description,
      item.descriptionZh,
      item.owner,
      item.repo,
      item.type,
      item.language,
      ...(item.topics || []),
    ].filter(Boolean).join(" ").toLowerCase(),
  };
}

export const packages = [...curatedPackages, ...discoveredPackages].map(withSearchText);

function repositoryMetadata(githubTopicCatalog) {
  const metadata = [...githubTopicCatalog.plugins, ...(githubTopicCatalog.repositoryMetadata || [])];
  return new Map(metadata.flatMap((item) => [item.repo, ...(item.aliases || [])]
    .map((repo) => [repo.toLowerCase(), item])));
}

function enrichPackage(item, metadataByRepo) {
  const metadata = metadataByRepo.get(item.repo.toLowerCase());
  if (!metadata) return item;
  return {
    ...item,
    repo: metadata.repo,
    owner: metadata.repo.split("/")[0],
    stars: metadata.stars,
    forks: metadata.forks,
    language: metadata.language,
    license: metadata.license,
    topics: metadata.topics,
    pushedAt: metadata.pushedAt,
    ...(metadata.headSha ? { headSha: metadata.headSha } : {}),
    ...(metadata.bundlePatch ? { bundlePatch: metadata.bundlePatch } : {}),
    ...(metadata.lifecycleScripts ? { lifecycleScripts: metadata.lifecycleScripts } : {}),
  };
}

export function compareByStars(a, b) {
  return (Number(b.stars) || 0) - (Number(a.stars) || 0)
    || (Date.parse(b.pushedAt) || 0) - (Date.parse(a.pushedAt) || 0)
    || a.name.localeCompare(b.name);
}

export function packagesWithGithubTopic(githubTopicCatalog) {
  const metadataByRepo = repositoryMetadata(githubTopicCatalog);
  const topicPackages = createTopicPackages(githubTopicCatalog);
  const topicNames = new Set(topicPackages.map((item) => item.name.toLowerCase()));
  const topicRepos = new Set(topicPackages.map((item) => item.repo.toLowerCase()));
  const uniqueAwesomePackages = discoveredPackages.filter((item) => (
    !topicNames.has(item.name.toLowerCase()) && !topicRepos.has(item.repo.toLowerCase())
  ));
  return [
    ...curatedPackages.map((item) => enrichPackage(item, metadataByRepo)),
    ...topicPackages,
    ...uniqueAwesomePackages.map((item) => enrichPackage(item, metadataByRepo)),
  ].map(withSearchText);
}

export const catalogMeta = {
  sources: {
    awesome: awesomeCatalog.meta,
  },
  indexedTotal: packages.length,
  discoveredTotal: discoveredPackages.length,
};
