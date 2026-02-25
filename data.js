(function () {
  const CATEGORIES = [
    { name: 'All Shortcuts', icon: '⭐' },
    { name: 'Linux', icon: '🐧' },
    { name: 'Windows', icon: '🪟' },
    { name: 'macOS', icon: '🍎' },
    { name: 'Editors', icon: '✍️' },
    { name: 'Terminal / Multiplexer', icon: '⌨️' },
    { name: 'Cloud', icon: '☁️' },
    { name: 'My Custom / Notes', icon: '🗂️' },
  ];

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  function flag(name, description, example, level, usage) {
    return {
      name,
      description,
      example: example || '',
      level: level || 'advanced',
      usage: usage || 'rare',
    };
  }

  function uniqFlags(flags) {
    const seen = new Set();
    const out = [];
    (flags || []).forEach((f) => {
      if (!f || !f.name) return;
      const key = f.name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(f);
    });
    return out;
  }

  function expandEntries(config) {
    const {
      group,
      program,
      categories,
      docs,
      source,
      entries,
      sharedFlags,
      expandFlags,
      allowFlagCombo,
    } = config;

    const out = [];

    entries.forEach((item, idx) => {
      const baseFlags = uniqFlags([...(item.flags || []), ...(typeof sharedFlags === 'function' ? sharedFlags(item) : sharedFlags || [])]);
      const idBase = `${slug(group)}-${slug(item.shortcut)}-${idx + 1}`;
      const base = {
        id: idBase,
        group,
        program,
        categories,
        docs,
        shortcut: item.shortcut,
        baseShortcut: item.shortcut,
        flagSuffix: '',
        description: item.description,
        tags: item.tags || [],
        synonyms: item.synonyms || [],
        examples: item.examples || [],
        usage: item.usage || 'regular',
        level: item.level || 'intermediate',
        flags: baseFlags,
        featured: Boolean(item.featured),
        source: source || 'built-in',
        detail: {
          overview: item.overview || item.description,
          syntax: item.syntax || item.shortcut,
          whenToUse: item.whenToUse || '',
          output: item.output || '',
          notes: item.notes || [],
        },
      };

      out.push(base);

      if (!expandFlags) return;

      baseFlags.forEach((f, fIdx) => {
        const variantShortcut = f.example ? `${base.shortcut} ${f.example}` : `${base.shortcut} ${f.name}`;
        out.push({
          ...base,
          id: `${idBase}-flag-${fIdx + 1}`,
          shortcut: variantShortcut,
          baseShortcut: base.shortcut,
          flagSuffix: f.example || f.name,
          description: `${base.description} (${f.name}: ${f.description})`,
          usage: f.usage || 'rare',
          level: f.level || 'advanced',
          flagVariant: true,
          primaryFlag: f.name,
          detail: {
            ...base.detail,
            overview: `${base.description} focused on ${f.name}.`,
            syntax: variantShortcut,
            notes: [`Flag ${f.name}: ${f.description}`, ...(base.detail.notes || [])],
          },
        });
      });

      if (allowFlagCombo && baseFlags.length >= 2) {
        const f1 = baseFlags[0];
        const f2 = baseFlags[1];
        const comboSuffix = `${f1.example || f1.name} ${f2.example || f2.name}`;
        out.push({
          ...base,
          id: `${idBase}-flag-combo`,
          shortcut: `${base.shortcut} ${comboSuffix}`,
          baseShortcut: base.shortcut,
          flagSuffix: comboSuffix,
          description: `${base.description} with combined flags (${f1.name} + ${f2.name}).`,
          usage: 'rare',
          level: 'advanced',
          flagVariant: true,
          primaryFlag: `${f1.name}, ${f2.name}`,
          detail: {
            ...base.detail,
            syntax: `${base.shortcut} ${comboSuffix}`,
            overview: `${base.description} with two useful flags combined.`,
          },
        });
      }
    });

    return out;
  }

  const SHARED = {
    gcloud: [
      flag('--project <id>', 'Run command against a selected GCP project.', '--project my-prod', 'intermediate', 'regular'),
      flag('--format=json', 'Return output as JSON for tooling.', '--format=json', 'intermediate', 'regular'),
      flag('--filter="..."', 'Filter resources server-side.', '--filter="status=RUNNING"', 'advanced', 'regular'),
      flag('--quiet', 'Suppress confirmation prompts.', '--quiet', 'intermediate', 'regular'),
    ],
    aws: [
      flag('--region <region>', 'Override configured AWS region.', '--region us-east-1', 'intermediate', 'regular'),
      flag('--profile <name>', 'Use a named AWS profile.', '--profile prod', 'intermediate', 'regular'),
      flag('--query <jmespath>', 'Shape output with JMESPath query.', '--query "Instances[*].InstanceId"', 'advanced', 'regular'),
      flag('--output json', 'Output in json/table/text/yaml.', '--output json', 'intermediate', 'regular'),
    ],
    azure: [
      flag('--subscription <id>', 'Run command in specific Azure subscription.', '--subscription my-sub', 'intermediate', 'regular'),
      flag('--resource-group <rg>', 'Scope command to resource group.', '--resource-group rg-prod', 'intermediate', 'regular'),
      flag('--query <jmespath>', 'Project/filter command output.', '--query "[].name"', 'advanced', 'regular'),
      flag('--output table', 'Format command output.', '--output table', 'intermediate', 'regular'),
    ],
    git: [
      flag('--help', 'Show inline help for command.', '--help', 'basic', 'rare'),
      flag('--verbose', 'Show more detailed command output.', '--verbose', 'intermediate', 'regular'),
      flag('--dry-run', 'Preview changes without applying.', '--dry-run', 'advanced', 'regular'),
    ],
    linux: [
      flag('--help', 'Display built-in help and options.', '--help', 'basic', 'rare'),
      flag('-h', 'Use human-readable units when supported.', '-h', 'basic', 'regular'),
      flag('--verbose', 'Show extra runtime details.', '--verbose', 'intermediate', 'rare'),
    ],
  };

  const vimEntries = [
    ['i', 'Enter insert mode.', 'common', 'basic', ['mode']],
    ['a', 'Append after cursor.', 'common', 'basic', ['mode']],
    ['o', 'Open line below and insert.', 'regular', 'basic', ['editing']],
    ['Esc', 'Return to normal mode.', 'common', 'basic', ['mode']],
    ['dd', 'Delete current line.', 'common', 'basic', ['delete']],
    ['yy', 'Yank current line.', 'common', 'basic', ['copy']],
    ['p', 'Paste after cursor.', 'common', 'basic', ['paste']],
    ['u', 'Undo change.', 'common', 'basic', ['undo']],
    ['Ctrl+r', 'Redo change.', 'regular', 'basic', ['redo']],
    ['gg', 'Go to first line.', 'regular', 'basic', ['navigation']],
    ['G', 'Go to last line.', 'regular', 'basic', ['navigation']],
    ['w', 'Move forward by word.', 'common', 'basic', ['navigation']],
    ['b', 'Move backward by word.', 'common', 'basic', ['navigation']],
    ['$', 'Move to end of line.', 'common', 'basic', ['navigation']],
    ['0', 'Move to start of line.', 'common', 'basic', ['navigation']],
    ['/pattern', 'Search forward for pattern.', 'common', 'basic', ['search']],
    ['n', 'Next search result.', 'regular', 'basic', ['search']],
    [':w', 'Write file.', 'common', 'basic', ['save']],
    [':q', 'Quit current window.', 'common', 'basic', ['quit']],
    [':wq', 'Save and quit.', 'common', 'basic', ['save', 'quit']],
    [':q!', 'Quit without saving.', 'regular', 'basic', ['quit']],
    [':set number', 'Show line numbers.', 'regular', 'basic', ['view']],
    ['ciw', 'Change inside current word.', 'regular', 'intermediate', ['text-object']],
    ['di(', 'Delete inside parentheses.', 'regular', 'intermediate', ['text-object']],
    ['va"', 'Visually select around quotes.', 'rare', 'intermediate', ['text-object']],
    [':%s/foo/bar/g', 'Replace all matches in file.', 'regular', 'intermediate', ['replace']],
    [':%s/foo/bar/gc', 'Replace globally with confirmation.', 'regular', 'advanced', ['replace']],
    ['qa', 'Record macro in register a.', 'rare', 'advanced', ['macro']],
    ['@a', 'Replay macro in register a.', 'rare', 'advanced', ['macro']],
    ['@@', 'Replay last macro.', 'rare', 'advanced', ['macro']],
    [':reg', 'Show registers.', 'rare', 'intermediate', ['registers']],
    [':ls', 'List open buffers.', 'regular', 'intermediate', ['buffers']],
    [':bnext', 'Move to next buffer.', 'regular', 'intermediate', ['buffers']],
    [':bprev', 'Move to previous buffer.', 'regular', 'intermediate', ['buffers']],
    [':split', 'Horizontal split window.', 'regular', 'intermediate', ['windows']],
    [':vsplit', 'Vertical split window.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w h', 'Move to left split.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w l', 'Move to right split.', 'regular', 'intermediate', ['windows']],
    [':tabnew', 'Open new tab.', 'rare', 'intermediate', ['tabs']],
    ['gt', 'Go to next tab.', 'rare', 'intermediate', ['tabs']],
    [':copen', 'Open quickfix list.', 'rare', 'advanced', ['quickfix']],
    [':cn', 'Next quickfix entry.', 'rare', 'advanced', ['quickfix']],
    [':cp', 'Previous quickfix entry.', 'rare', 'advanced', ['quickfix']],
  ].map(([shortcut, description, usage, level, tags]) => ({ shortcut, description, usage, level, tags }));

  const vimExtendedEntries = [
    ['Ctrl+w +', 'Increase current split height.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w -', 'Decrease current split height.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w >', 'Increase current split width.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w <', 'Decrease current split width.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w =', 'Equalize all split sizes.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w _', 'Maximize split height.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w |', 'Maximize split width.', 'rare', 'advanced', ['windows']],
    [':resize +5', 'Increase split height by 5 lines.', 'rare', 'advanced', ['windows']],
    [':resize -5', 'Decrease split height by 5 lines.', 'rare', 'advanced', ['windows']],
    [':vertical resize +10', 'Increase vertical split width.', 'rare', 'advanced', ['windows']],
    [':vertical resize 80', 'Set split width to fixed size.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w r', 'Rotate split windows downward/right.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w R', 'Rotate split windows upward/left.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w x', 'Swap current split with next split.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w T', 'Move current split into new tab.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w q', 'Close active split.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w v', 'Vertical split from normal mode.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w s', 'Horizontal split from normal mode.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w k', 'Move to split above.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w j', 'Move to split below.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w w', 'Cycle through splits.', 'regular', 'intermediate', ['windows']],
    ['Ctrl+w H', 'Move split to far left.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w L', 'Move split to far right.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w K', 'Move split to top.', 'rare', 'advanced', ['windows']],
    ['Ctrl+w J', 'Move split to bottom.', 'rare', 'advanced', ['windows']],
    [':tabnext', 'Move to next tab page.', 'regular', 'intermediate', ['tabs']],
    [':tabprev', 'Move to previous tab page.', 'regular', 'intermediate', ['tabs']],
    [':tabclose', 'Close current tab.', 'regular', 'intermediate', ['tabs']],
    [':tabonly', 'Close all other tabs.', 'rare', 'advanced', ['tabs']],
    [':tabmove 0', 'Move current tab to first position.', 'rare', 'advanced', ['tabs']],
    ['gT', 'Go to previous tab.', 'regular', 'intermediate', ['tabs']],
    ['1gt', 'Go to tab number 1.', 'rare', 'intermediate', ['tabs']],
    [':marks', 'List all marks.', 'rare', 'intermediate', ['marks']],
    ['ma', 'Set mark a at current position.', 'regular', 'intermediate', ['marks']],
    ["'a", 'Jump to line of mark a.', 'regular', 'intermediate', ['marks']],
    ['`a', 'Jump to exact position of mark a.', 'regular', 'intermediate', ['marks']],
    [':jumps', 'Display jump list.', 'rare', 'intermediate', ['navigation']],
    ['Ctrl+o', 'Jump backward in jump list.', 'regular', 'intermediate', ['navigation']],
    ['Ctrl+i', 'Jump forward in jump list.', 'regular', 'intermediate', ['navigation']],
    [':changes', 'Show change list.', 'rare', 'advanced', ['navigation']],
    ['g;', 'Go to older change position.', 'rare', 'advanced', ['navigation']],
    ['g,', 'Go to newer change position.', 'rare', 'advanced', ['navigation']],
    [':nohlsearch', 'Clear search highlight.', 'regular', 'basic', ['search']],
    [':set hlsearch', 'Enable search highlighting.', 'regular', 'basic', ['search']],
    [':set incsearch', 'Enable incremental search.', 'regular', 'basic', ['search']],
    [':vimgrep /TODO/gj **/*.ts', 'Populate quickfix with project matches.', 'rare', 'advanced', ['quickfix']],
    [':lopen', 'Open location list.', 'rare', 'advanced', ['quickfix']],
    [':lnext', 'Next location list item.', 'rare', 'advanced', ['quickfix']],
    [':lprev', 'Previous location list item.', 'rare', 'advanced', ['quickfix']],
    [':set list', 'Show whitespace characters.', 'regular', 'intermediate', ['view']],
    [':set nowrap', 'Disable line wrapping.', 'regular', 'basic', ['view']],
    [':set wrap', 'Enable line wrapping.', 'regular', 'basic', ['view']],
    [':set cursorline', 'Highlight current line.', 'regular', 'basic', ['view']],
    [':set colorcolumn=100', 'Draw column marker at given width.', 'regular', 'intermediate', ['view']],
    [':set relativenumber!', 'Toggle relative numbers.', 'regular', 'basic', ['view']],
    ['>>', 'Indent current line.', 'common', 'basic', ['editing']],
    ['<<', 'Outdent current line.', 'common', 'basic', ['editing']],
    ['=%', 'Auto-indent around matching braces.', 'regular', 'intermediate', ['editing']],
    ['gqap', 'Format current paragraph.', 'regular', 'intermediate', ['editing']],
    ['vip', 'Select inner paragraph.', 'regular', 'intermediate', ['text-object']],
    ['vi"', 'Select text inside quotes.', 'regular', 'intermediate', ['text-object']],
    ['da{', 'Delete around braces.', 'regular', 'intermediate', ['text-object']],
    ['cit', 'Change inside HTML/XML tag.', 'rare', 'advanced', ['text-object']],
    [':set foldmethod=indent', 'Enable indentation-based folds.', 'rare', 'advanced', ['folding']],
    ['za', 'Toggle fold under cursor.', 'regular', 'intermediate', ['folding']],
    ['zR', 'Open all folds.', 'rare', 'advanced', ['folding']],
    ['zM', 'Close all folds.', 'rare', 'advanced', ['folding']],
    [':set spell', 'Enable spell checking.', 'rare', 'intermediate', ['editing']],
    [']s', 'Jump to next spelling issue.', 'rare', 'intermediate', ['editing']],
    ['[s', 'Jump to previous spelling issue.', 'rare', 'intermediate', ['editing']],
    [':terminal', 'Open terminal in split.', 'regular', 'intermediate', ['terminal']],
    ['Ctrl+w N', 'Switch terminal to Normal mode buffer.', 'rare', 'advanced', ['terminal']],
    [':help Ctrl-w_+', 'Open docs for window commands.', 'rare', 'advanced', ['help']],
  ].map(([shortcut, description, usage, level, tags]) => ({ shortcut, description, usage, level, tags }));

  const tmuxKeyEntries = [
    ['Ctrl+b c', 'Create new window.', 'common', 'basic', ['window']],
    ['Ctrl+b ,', 'Rename current window.', 'regular', 'basic', ['window']],
    ['Ctrl+b n', 'Go to next window.', 'common', 'basic', ['window']],
    ['Ctrl+b p', 'Go to previous window.', 'common', 'basic', ['window']],
    ['Ctrl+b l', 'Switch to last active window.', 'regular', 'basic', ['window']],
    ['Ctrl+b w', 'Open window chooser.', 'common', 'intermediate', ['window']],
    ['Ctrl+b f', 'Find window by name/content.', 'regular', 'intermediate', ['window']],
    ['Ctrl+b &', 'Kill current window with confirmation.', 'regular', 'intermediate', ['window']],
    ['Ctrl+b %', 'Split pane vertically (left/right).', 'common', 'basic', ['pane']],
    ['Ctrl+b \"', 'Split pane horizontally (top/bottom).', 'common', 'basic', ['pane']],
    ['Ctrl+b o', 'Select next pane.', 'common', 'basic', ['pane']],
    ['Ctrl+b ;', 'Toggle to last active pane.', 'regular', 'basic', ['pane']],
    ['Ctrl+b q', 'Show pane numbers.', 'regular', 'basic', ['pane']],
    ['Ctrl+b q 0..9', 'Jump directly to pane by number.', 'regular', 'intermediate', ['pane']],
    ['Ctrl+b x', 'Kill active pane.', 'regular', 'basic', ['pane']],
    ['Ctrl+b z', 'Zoom/unzoom active pane.', 'regular', 'intermediate', ['pane']],
    ['Ctrl+b {', 'Swap active pane with previous pane.', 'rare', 'advanced', ['pane']],
    ['Ctrl+b }', 'Swap active pane with next pane.', 'rare', 'advanced', ['pane']],
    ['Ctrl+b !', 'Break active pane into new window.', 'rare', 'advanced', ['pane']],
    ['Ctrl+b Space', 'Cycle through pane layouts.', 'regular', 'intermediate', ['pane']],
    ['Ctrl+b M-o', 'Rotate panes in current window.', 'rare', 'advanced', ['pane']],
    ['Ctrl+b Up/Down/Left/Right', 'Select pane in direction.', 'regular', 'intermediate', ['pane']],
    ['Ctrl+b Ctrl+Up/Down/Left/Right', 'Resize pane by 1 cell.', 'rare', 'advanced', ['pane']],
    ['Ctrl+b Alt+Up/Down/Left/Right', 'Resize pane by 5 cells.', 'rare', 'advanced', ['pane']],
    ['Ctrl+b [', 'Enter copy mode.', 'common', 'intermediate', ['copy-mode']],
    ['Ctrl+b ]', 'Paste most recent buffer.', 'regular', 'intermediate', ['copy-mode']],
    ['Ctrl+b #', 'List paste buffers.', 'rare', 'intermediate', ['copy-mode']],
    ['Ctrl+b =', 'Choose paste buffer interactively.', 'rare', 'intermediate', ['copy-mode']],
    ['Ctrl+b :', 'Open tmux command prompt.', 'common', 'intermediate', ['command']],
    ['Ctrl+b ?', 'List key bindings.', 'regular', 'intermediate', ['help']],
    ['Ctrl+b t', 'Show clock mode.', 'rare', 'intermediate', ['view']],
    ['Ctrl+b d', 'Detach current client.', 'common', 'basic', ['session']],
    ['Ctrl+b D', 'Choose client to detach.', 'rare', 'intermediate', ['session']],
    ['Ctrl+b s', 'Choose session interactively.', 'regular', 'intermediate', ['session']],
    ['Ctrl+b $', 'Rename session.', 'regular', 'intermediate', ['session']],
    ['Ctrl+b (', 'Switch to previous session.', 'rare', 'intermediate', ['session']],
    ['Ctrl+b )', 'Switch to next session.', 'rare', 'intermediate', ['session']],
  ];

  const tmuxCommandEntries = [
    ['tmux ls', 'List active tmux sessions.', 'common', 'basic', ['session']],
    ['tmux list-sessions', 'List all sessions (long form).', 'regular', 'basic', ['session']],
    ['tmux new -s <name>', 'Create named session.', 'common', 'basic', ['session']],
    ['tmux new-session -s <name> -d', 'Create session detached.', 'regular', 'intermediate', ['session']],
    ['tmux attach -t <name>', 'Attach to session by name.', 'common', 'basic', ['session']],
    ['tmux attach-session -t <name>', 'Attach to target session.', 'regular', 'basic', ['session']],
    ['tmux switch-client -t <name>', 'Switch current client to target session.', 'regular', 'intermediate', ['session']],
    ['tmux detach-client', 'Detach current client.', 'regular', 'intermediate', ['session']],
    ['tmux detach-client -a', 'Detach all other clients.', 'rare', 'advanced', ['session']],
    ['tmux kill-session -t <name>', 'Kill selected session.', 'regular', 'intermediate', ['session']],
    ['tmux kill-server', 'Kill entire tmux server and all sessions.', 'rare', 'advanced', ['session']],
    ['tmux has-session -t <name>', 'Check if session exists (exit status).', 'regular', 'intermediate', ['session']],
    ['tmux rename-session -t <old> <new>', 'Rename session.', 'regular', 'intermediate', ['session']],
    ['tmux lock-session -t <name>', 'Lock session.', 'rare', 'intermediate', ['session']],
    ['tmux lock-server', 'Lock tmux server.', 'rare', 'advanced', ['session']],
    ['tmux lock-client', 'Lock current client.', 'rare', 'intermediate', ['session']],

    ['tmux new-window -n <name>', 'Create new window.', 'common', 'basic', ['window']],
    ['tmux list-windows', 'List windows in current session.', 'common', 'basic', ['window']],
    ['tmux select-window -t :2', 'Select window by index.', 'regular', 'basic', ['window']],
    ['tmux next-window', 'Go to next window.', 'regular', 'basic', ['window']],
    ['tmux previous-window', 'Go to previous window.', 'regular', 'basic', ['window']],
    ['tmux last-window', 'Go to last active window.', 'regular', 'basic', ['window']],
    ['tmux kill-window -t :2', 'Kill target window.', 'regular', 'intermediate', ['window']],
    ['tmux rename-window -t :2 api', 'Rename target window.', 'regular', 'intermediate', ['window']],
    ['tmux move-window -s :2 -t :5', 'Move window index/position.', 'rare', 'advanced', ['window']],
    ['tmux swap-window -s :1 -t :3', 'Swap two windows.', 'rare', 'advanced', ['window']],
    ['tmux link-window -s dev:1 -t ops:', 'Link window into another session.', 'rare', 'advanced', ['window']],
    ['tmux unlink-window -t :2', 'Unlink window from session.', 'rare', 'advanced', ['window']],
    ['tmux find-window nginx', 'Find window by pattern.', 'regular', 'intermediate', ['window']],
    ['tmux select-layout tiled', 'Apply tiled layout.', 'regular', 'intermediate', ['window']],
    ['tmux next-layout', 'Cycle to next layout.', 'regular', 'intermediate', ['window']],
    ['tmux previous-layout', 'Cycle to previous layout.', 'rare', 'intermediate', ['window']],
    ['tmux rotate-window', 'Rotate panes in window.', 'rare', 'advanced', ['window']],
    ['tmux resize-window -x 200 -y 50', 'Resize window dimensions.', 'rare', 'advanced', ['window']],
    ['tmux respawn-window -k -t :2', 'Restart dead window command.', 'rare', 'advanced', ['window']],

    ['tmux split-window -h', 'Split pane horizontally (left/right).', 'common', 'basic', ['pane']],
    ['tmux split-window -v', 'Split pane vertically (top/bottom).', 'common', 'basic', ['pane']],
    ['tmux list-panes', 'List panes in current window.', 'regular', 'basic', ['pane']],
    ['tmux select-pane -t :.1', 'Select pane by id/index.', 'regular', 'basic', ['pane']],
    ['tmux select-pane -L/-R/-U/-D', 'Select pane by direction.', 'regular', 'intermediate', ['pane']],
    ['tmux resize-pane -L 10', 'Resize pane left by 10.', 'regular', 'intermediate', ['pane']],
    ['tmux resize-pane -R 10', 'Resize pane right by 10.', 'regular', 'intermediate', ['pane']],
    ['tmux resize-pane -U 5', 'Resize pane up by 5.', 'regular', 'intermediate', ['pane']],
    ['tmux resize-pane -D 5', 'Resize pane down by 5.', 'regular', 'intermediate', ['pane']],
    ['tmux resize-pane -Z', 'Toggle pane zoom.', 'regular', 'intermediate', ['pane']],
    ['tmux swap-pane -s :.1 -t :.2', 'Swap two panes.', 'rare', 'advanced', ['pane']],
    ['tmux move-pane -s :.1 -t :2.0', 'Move pane to another window.', 'rare', 'advanced', ['pane']],
    ['tmux join-pane -s :2.1 -t :1.0', 'Join pane into target window.', 'rare', 'advanced', ['pane']],
    ['tmux break-pane -d -s :1.2', 'Break pane into detached window.', 'rare', 'advanced', ['pane']],
    ['tmux kill-pane -t :1.2', 'Kill target pane.', 'regular', 'intermediate', ['pane']],
    ['tmux last-pane', 'Switch to previously active pane.', 'regular', 'basic', ['pane']],
    ['tmux display-panes', 'Show pane numbers overlay.', 'regular', 'intermediate', ['pane']],
    ['tmux pipe-pane -o \"cat >> pane.log\"', 'Pipe pane output to command/file.', 'rare', 'advanced', ['pane']],
    ['tmux capture-pane -pS -100', 'Capture pane history/output.', 'regular', 'advanced', ['pane']],
    ['tmux clear-history', 'Clear pane history buffer.', 'rare', 'advanced', ['pane']],
    ['tmux respawn-pane -k -t :1.1', 'Restart command in pane.', 'rare', 'advanced', ['pane']],

    ['tmux copy-mode', 'Enter copy mode.', 'regular', 'intermediate', ['copy-mode']],
    ['tmux copy-mode -u', 'Enter copy mode and scroll up one page.', 'rare', 'advanced', ['copy-mode']],
    ['tmux send-keys -t :1.0 C-c', 'Send keys to pane.', 'regular', 'intermediate', ['copy-mode']],
    ['tmux send-prefix -t :1.0', 'Send tmux prefix to application.', 'rare', 'advanced', ['copy-mode']],
    ['tmux paste-buffer', 'Paste latest buffer.', 'regular', 'intermediate', ['copy-mode']],
    ['tmux choose-buffer', 'Choose buffer interactively.', 'rare', 'intermediate', ['copy-mode']],
    ['tmux list-buffers', 'List paste buffers.', 'regular', 'intermediate', ['copy-mode']],
    ['tmux show-buffer', 'Show latest buffer content.', 'rare', 'intermediate', ['copy-mode']],
    ['tmux save-buffer ~/tmux-buffer.txt', 'Save buffer to file.', 'rare', 'advanced', ['copy-mode']],
    ['tmux load-buffer ~/snippet.txt', 'Load file into tmux buffer.', 'rare', 'advanced', ['copy-mode']],
    ['tmux set-buffer \"hello\"', 'Set buffer content manually.', 'rare', 'advanced', ['copy-mode']],
    ['tmux delete-buffer -b 0', 'Delete specific buffer.', 'rare', 'advanced', ['copy-mode']],

    ['tmux list-clients', 'List attached clients.', 'regular', 'intermediate', ['client']],
    ['tmux choose-client', 'Choose client interactively.', 'rare', 'advanced', ['client']],
    ['tmux display-message \"#{session_name}\"', 'Display formatted message.', 'regular', 'intermediate', ['client']],
    ['tmux display-message -p \"#{pane_current_path}\"', 'Print expanded format string.', 'rare', 'advanced', ['client']],
    ['tmux refresh-client -S', 'Refresh status line/client.', 'rare', 'advanced', ['client']],
    ['tmux display-menu -T \"tmux\"', 'Open popup menu for client.', 'rare', 'advanced', ['client']],
    ['tmux display-popup -E \"htop\"', 'Open popup running command.', 'rare', 'advanced', ['client']],
    ['tmux choose-tree -Zw', 'Open tree mode for sessions/windows/panes.', 'rare', 'advanced', ['client']],

    ['tmux set-option -g mouse on', 'Enable mouse support globally.', 'common', 'intermediate', ['config']],
    ['tmux set-option -g history-limit 100000', 'Increase scrollback history.', 'regular', 'intermediate', ['config']],
    ['tmux set-option -g base-index 1', 'Start window numbering at 1.', 'regular', 'intermediate', ['config']],
    ['tmux set-window-option -g pane-base-index 1', 'Start pane numbering at 1.', 'regular', 'intermediate', ['config']],
    ['tmux set-option -g status-position top', 'Move status bar to top.', 'regular', 'intermediate', ['config']],
    ['tmux set-option -g prefix C-a', 'Change tmux prefix key.', 'rare', 'advanced', ['config']],
    ['tmux set-option -g renumber-windows on', 'Renumber windows after close.', 'regular', 'intermediate', ['config']],
    ['tmux set-option -g focus-events on', 'Enable terminal focus events.', 'rare', 'advanced', ['config']],
    ['tmux set-option -g detach-on-destroy off', 'Keep client attached on session destroy.', 'rare', 'advanced', ['config']],
    ['tmux set-option -g status-interval 5', 'Set status refresh interval.', 'regular', 'intermediate', ['config']],
    ['tmux show-options -g', 'Show global session options.', 'regular', 'intermediate', ['config']],
    ['tmux show-window-options -g', 'Show global window options.', 'regular', 'intermediate', ['config']],
    ['tmux show-hooks -g', 'Show configured hooks.', 'rare', 'advanced', ['config']],
    ['tmux set-hook -g client-attached \"display-message attached\"', 'Set global hook action.', 'rare', 'advanced', ['config']],
    ['tmux source-file ~/.tmux.conf', 'Reload tmux config file.', 'common', 'intermediate', ['config']],
    ['tmux source-file -n ~/.tmux.conf', 'Parse config without applying.', 'rare', 'advanced', ['config']],
    ['tmux bind-key -n C-s split-window -v', 'Bind key to command.', 'regular', 'advanced', ['config']],
    ['tmux unbind-key C-b', 'Remove key binding.', 'regular', 'advanced', ['config']],
    ['tmux list-keys', 'List active key bindings.', 'regular', 'intermediate', ['config']],
    ['tmux list-commands', 'List all available tmux commands.', 'regular', 'intermediate', ['config']],

    ['tmux if-shell \"test -f .env\" \"display-message ok\"', 'Conditional shell execution in tmux.', 'rare', 'advanced', ['scripting']],
    ['tmux run-shell \"echo hi\"', 'Run shell command from tmux context.', 'regular', 'advanced', ['scripting']],
    ['tmux wait-for -S ready', 'Signal named tmux wait channel.', 'rare', 'advanced', ['scripting']],
    ['tmux wait-for ready', 'Wait for named signal.', 'rare', 'advanced', ['scripting']],
    ['tmux command-prompt -p \"name\" \"rename-session %%\"', 'Prompt user and run tmux command.', 'rare', 'advanced', ['scripting']],
    ['tmux confirm-before -p \"Kill pane?\" \"kill-pane\"', 'Ask confirmation before command.', 'rare', 'advanced', ['scripting']],
    ['tmux set-environment -g API_ENV prod', 'Set global environment variable.', 'regular', 'intermediate', ['scripting']],
    ['tmux show-environment -g', 'Show global tmux environment.', 'regular', 'intermediate', ['scripting']],
    ['tmux set-environment -gru API_ENV', 'Unset tmux environment variable.', 'rare', 'advanced', ['scripting']],
    ['tmux show-messages -JT', 'Show message log with job/tree details.', 'rare', 'advanced', ['scripting']],
    ['tmux clock-mode', 'Open clock mode.', 'rare', 'intermediate', ['view']],
  ];

  const tmuxEntries = [...tmuxKeyEntries, ...tmuxCommandEntries].map(([shortcut, description, usage, level, tags]) => ({
    shortcut,
    description,
    usage,
    level,
    tags,
  }));

  const vscodeEntries = [
    ['Ctrl+Shift+P', 'Open command palette.', 'common', 'basic', ['palette']],
    ['Ctrl+P', 'Quick open files.', 'common', 'basic', ['files']],
    ['Ctrl+`', 'Toggle terminal.', 'common', 'basic', ['terminal']],
    ['Ctrl+B', 'Toggle sidebar.', 'common', 'basic', ['layout']],
    ['Ctrl+Shift+E', 'Focus Explorer.', 'regular', 'basic', ['explorer']],
    ['Ctrl+Shift+F', 'Global search.', 'common', 'basic', ['search']],
    ['Ctrl+F', 'Search in file.', 'common', 'basic', ['search']],
    ['Alt+Up / Alt+Down', 'Move line up/down.', 'regular', 'basic', ['editing']],
    ['Shift+Alt+F', 'Format document.', 'common', 'basic', ['format']],
    ['Ctrl+/', 'Toggle line comment.', 'common', 'basic', ['comment']],
    ['F2', 'Rename symbol.', 'regular', 'intermediate', ['refactor']],
    ['Ctrl+.', 'Quick fix/code actions.', 'regular', 'intermediate', ['refactor']],
    ['Ctrl+D', 'Select next occurrence.', 'regular', 'intermediate', ['multi-cursor']],
    ['Ctrl+Shift+L', 'Select all occurrences.', 'regular', 'intermediate', ['multi-cursor']],
    ['Ctrl+K Ctrl+S', 'Open keyboard shortcuts.', 'rare', 'intermediate', ['keybindings']],
    ['Ctrl+Shift+`', 'Create new terminal.', 'regular', 'intermediate', ['terminal']],
    ['Ctrl+Shift+5', 'Split editor.', 'regular', 'intermediate', ['layout']],
    ['Ctrl+W', 'Close editor.', 'common', 'basic', ['tabs']],
    ['Ctrl+K W', 'Close all editors.', 'regular', 'intermediate', ['tabs']],
    ['Ctrl+Shift+N', 'New window.', 'rare', 'basic', ['window']],
    ['Ctrl+Shift+T', 'Reopen closed editor.', 'regular', 'intermediate', ['tabs']],
    ['F8', 'Next problem in file.', 'regular', 'intermediate', ['problems']],
    ['Shift+F8', 'Previous problem.', 'regular', 'intermediate', ['problems']],
    ['Ctrl+K Ctrl+0', 'Fold all regions.', 'rare', 'advanced', ['folding']],
    ['Ctrl+K Ctrl+J', 'Unfold all regions.', 'rare', 'advanced', ['folding']],
    ['Ctrl+Shift+U', 'Open output panel.', 'rare', 'intermediate', ['logs']],
  ].map(([shortcut, description, usage, level, tags]) => ({ shortcut, description, usage, level, tags }));

  const vscodeExtendedEntries = [
    ['Ctrl+N', 'Create new file.', 'common', 'basic', ['files']],
    ['Ctrl+O', 'Open file picker.', 'common', 'basic', ['files']],
    ['Ctrl+S', 'Save current file.', 'common', 'basic', ['files']],
    ['Ctrl+Shift+S', 'Save current file as...', 'regular', 'basic', ['files']],
    ['Ctrl+K S', 'Save all files.', 'regular', 'intermediate', ['files']],
    ['Ctrl+K Ctrl+W', 'Close all editors in group.', 'regular', 'intermediate', ['tabs']],
    ['Ctrl+PageUp', 'Switch to previous editor tab.', 'regular', 'intermediate', ['tabs']],
    ['Ctrl+PageDown', 'Switch to next editor tab.', 'regular', 'intermediate', ['tabs']],
    ['Ctrl+1', 'Focus first editor group.', 'regular', 'intermediate', ['layout']],
    ['Ctrl+2', 'Focus second editor group.', 'regular', 'intermediate', ['layout']],
    ['Ctrl+3', 'Focus third editor group.', 'rare', 'intermediate', ['layout']],
    ['Ctrl+K Ctrl+Left', 'Move editor to left group.', 'regular', 'intermediate', ['layout']],
    ['Ctrl+K Ctrl+Right', 'Move editor to right group.', 'regular', 'intermediate', ['layout']],
    ['Ctrl+Shift+M', 'Open Problems panel.', 'regular', 'basic', ['problems']],
    ['Ctrl+Shift+O', 'Go to symbol in file.', 'common', 'basic', ['navigation']],
    ['Ctrl+T', 'Go to symbol in workspace.', 'regular', 'intermediate', ['navigation']],
    ['Ctrl+G', 'Go to specific line.', 'common', 'basic', ['navigation']],
    ['Ctrl+Shift+\\', 'Jump to matching bracket.', 'regular', 'basic', ['navigation']],
    ['Ctrl+K Ctrl+C', 'Add line comment.', 'regular', 'basic', ['comment']],
    ['Ctrl+K Ctrl+U', 'Remove line comment.', 'regular', 'basic', ['comment']],
    ['Alt+Click', 'Insert additional cursor at click.', 'regular', 'intermediate', ['multi-cursor']],
    ['Ctrl+Alt+Up', 'Add cursor above.', 'regular', 'intermediate', ['multi-cursor']],
    ['Ctrl+Alt+Down', 'Add cursor below.', 'regular', 'intermediate', ['multi-cursor']],
    ['Ctrl+L', 'Select current line.', 'regular', 'basic', ['selection']],
    ['Ctrl+Shift+K', 'Delete current line.', 'regular', 'basic', ['editing']],
    ['Ctrl+Enter', 'Insert line below.', 'common', 'basic', ['editing']],
    ['Ctrl+Shift+Enter', 'Insert line above.', 'regular', 'basic', ['editing']],
    ['Ctrl+Shift+[', 'Fold region.', 'regular', 'intermediate', ['folding']],
    ['Ctrl+Shift+]', 'Unfold region.', 'regular', 'intermediate', ['folding']],
    ['Ctrl+K Ctrl+1', 'Fold level 1.', 'rare', 'advanced', ['folding']],
    ['Ctrl+K Ctrl+2', 'Fold level 2.', 'rare', 'advanced', ['folding']],
    ['Ctrl+K Ctrl+3', 'Fold level 3.', 'rare', 'advanced', ['folding']],
    ['Ctrl+K Ctrl+[', 'Fold all block comments.', 'rare', 'advanced', ['folding']],
    ['Ctrl+K Ctrl+]', 'Unfold all block comments.', 'rare', 'advanced', ['folding']],
    ['Ctrl+K Ctrl+F', 'Format selected text.', 'regular', 'intermediate', ['format']],
    ['Shift+Alt+Down', 'Copy line down.', 'regular', 'basic', ['editing']],
    ['Shift+Alt+Up', 'Copy line up.', 'regular', 'basic', ['editing']],
    ['Ctrl+Shift+K', 'Delete line.', 'regular', 'basic', ['editing']],
    ['Ctrl+K Ctrl+D', 'Move selection to next find match.', 'rare', 'advanced', ['multi-cursor']],
    ['Ctrl+H', 'Replace in file.', 'common', 'basic', ['search']],
    ['Ctrl+Shift+H', 'Replace in files.', 'regular', 'intermediate', ['search']],
    ['Alt+Enter', 'Select all search matches.', 'regular', 'intermediate', ['search']],
    ['F12', 'Go to definition.', 'common', 'intermediate', ['navigation']],
    ['Alt+F12', 'Peek definition.', 'regular', 'intermediate', ['navigation']],
    ['Shift+F12', 'Show references.', 'regular', 'intermediate', ['navigation']],
    ['Ctrl+K Ctrl+I', 'Show hover tooltip.', 'regular', 'intermediate', ['navigation']],
    ['Ctrl+Shift+.', 'Navigate to breadcrumb symbol right.', 'rare', 'advanced', ['navigation']],
    ['Ctrl+Shift+,', 'Navigate to breadcrumb symbol left.', 'rare', 'advanced', ['navigation']],
    ['Ctrl+Shift+Tab', 'Open previous recently used editor.', 'regular', 'intermediate', ['tabs']],
    ['Ctrl+K Z', 'Zen mode.', 'rare', 'intermediate', ['layout']],
    ['Ctrl+J', 'Toggle panel visibility.', 'regular', 'basic', ['layout']],
    ['Ctrl+Shift+`', 'Open terminal and focus.', 'regular', 'basic', ['terminal']],
    ['Ctrl+Shift+5', 'Split terminal.', 'regular', 'intermediate', ['terminal']],
    ['Ctrl+Shift+7', 'Rename terminal.', 'rare', 'advanced', ['terminal']],
    ['Ctrl+Shift+8', 'Kill terminal.', 'regular', 'intermediate', ['terminal']],
    ['F5', 'Start debugging.', 'regular', 'basic', ['debug']],
    ['Shift+F5', 'Stop debugging.', 'regular', 'basic', ['debug']],
    ['F9', 'Toggle breakpoint.', 'regular', 'basic', ['debug']],
    ['F10', 'Step over.', 'regular', 'intermediate', ['debug']],
    ['F11', 'Step into.', 'regular', 'intermediate', ['debug']],
    ['Shift+F11', 'Step out.', 'regular', 'intermediate', ['debug']],
    ['Ctrl+Shift+D', 'Open Run and Debug view.', 'regular', 'basic', ['debug']],
    ['Ctrl+Shift+X', 'Open Extensions view.', 'regular', 'basic', ['extensions']],
    ['Ctrl+K Ctrl+M', 'Change language mode.', 'regular', 'basic', ['files']],
    ['Ctrl+K V', 'Open markdown preview to side.', 'regular', 'intermediate', ['markdown']],
    ['Ctrl+Shift+V', 'Toggle markdown preview.', 'regular', 'intermediate', ['markdown']],
    ['Ctrl+K Ctrl+T', 'Select color theme.', 'regular', 'basic', ['settings']],
    ['Ctrl+,', 'Open settings UI.', 'regular', 'basic', ['settings']],
    ['Ctrl+Shift+P > Preferences: Open Settings (JSON)', 'Open raw settings.json quickly.', 'rare', 'advanced', ['settings']],
  ].map(([shortcut, description, usage, level, tags]) => ({ shortcut, description, usage, level, tags }));

  const neovimEntries = [
    [':Lazy', 'Open plugin manager UI.', 'regular', 'intermediate', ['plugins']],
    [':Mason', 'Open LSP/tool installer.', 'regular', 'intermediate', ['lsp']],
    [':checkhealth', 'Run health diagnostics.', 'regular', 'intermediate', ['diagnostics']],
    [':Telescope find_files', 'Find files with Telescope.', 'common', 'intermediate', ['search']],
    [':Telescope live_grep', 'Search text across project.', 'common', 'intermediate', ['search']],
    [':Telescope buffers', 'List open buffers.', 'regular', 'intermediate', ['buffers']],
    [':LspInfo', 'Show active LSP clients.', 'regular', 'intermediate', ['lsp']],
    ['gd', 'Go to definition.', 'common', 'intermediate', ['lsp']],
    ['gr', 'Find references.', 'regular', 'intermediate', ['lsp']],
    ['K', 'Hover documentation.', 'regular', 'intermediate', ['lsp']],
    [':lua vim.lsp.buf.format()', 'Format current buffer.', 'regular', 'intermediate', ['format']],
    [':TSInstall <lang>', 'Install treesitter parser.', 'rare', 'advanced', ['treesitter']],
    [':messages', 'Show recent messages.', 'rare', 'intermediate', ['debug']],
    [':lua print(vim.inspect(vim.fn.getqflist()))', 'Inspect quickfix list in Lua.', 'rare', 'advanced', ['debug']],
    [':h lua-guide', 'Open Lua integration help.', 'rare', 'advanced', ['help']],
    [':h diagnostic-api', 'Diagnostic API reference.', 'rare', 'advanced', ['help']],
    [':h autocmd-events', 'Autocmd events reference.', 'rare', 'advanced', ['help']],
    [':set relativenumber', 'Enable relative line numbers.', 'regular', 'basic', ['view']],
    [':set signcolumn=yes', 'Always show sign column.', 'regular', 'intermediate', ['view']],
    [':verbose map <leader>', 'Debug leader key mappings.', 'rare', 'advanced', ['debug']],
  ].map(([shortcut, description, usage, level, tags]) => ({ shortcut, description, usage, level, tags }));

  const windowsEntries = [
    ['Win+V', 'Open clipboard history.', 'common', 'basic', ['clipboard']],
    ['Win+Shift+S', 'Screen snip tool.', 'common', 'basic', ['screenshot']],
    ['Win+D', 'Toggle desktop view.', 'common', 'basic', ['desktop']],
    ['Win+E', 'Open File Explorer.', 'common', 'basic', ['files']],
    ['Win+L', 'Lock computer.', 'common', 'basic', ['security']],
    ['Alt+Tab', 'Switch open apps.', 'common', 'basic', ['switching']],
    ['Ctrl+Shift+Esc', 'Open Task Manager.', 'common', 'basic', ['system']],
    ['Win+.', 'Emoji picker.', 'regular', 'basic', ['emoji']],
    ['Win+R', 'Open Run dialog.', 'regular', 'basic', ['launcher']],
    ['Win+X', 'Power user menu.', 'regular', 'basic', ['system']],
    ['Win+I', 'Open Settings.', 'regular', 'basic', ['settings']],
    ['Win+P', 'Project display options.', 'regular', 'intermediate', ['display']],
    ['Win+Ctrl+D', 'Create virtual desktop.', 'regular', 'intermediate', ['desktop']],
    ['Win+Ctrl+Left/Right', 'Switch virtual desktop.', 'regular', 'intermediate', ['desktop']],
    ['Win+Ctrl+F4', 'Close virtual desktop.', 'rare', 'intermediate', ['desktop']],
    ['Win+1..9', 'Open pinned taskbar app.', 'regular', 'basic', ['taskbar']],
    ['Win+Shift+Left/Right', 'Move window between monitors.', 'rare', 'intermediate', ['window']],
    ['Win+Arrow Keys', 'Snap windows.', 'common', 'basic', ['window']],
    ['Win+Plus', 'Open Magnifier.', 'rare', 'intermediate', ['accessibility']],
    ['Win+Pause', 'Open System settings page.', 'rare', 'intermediate', ['system']],
  ].map(([shortcut, description, usage, level, tags]) => ({ shortcut, description, usage, level, tags }));

  const macEntries = [
    ['Cmd+Space', 'Open Spotlight.', 'common', 'basic', ['search']],
    ['Cmd+Tab', 'Switch apps.', 'common', 'basic', ['switching']],
    ['Cmd+`', 'Switch windows in app.', 'regular', 'basic', ['windows']],
    ['Cmd+Shift+4', 'Capture selected screenshot.', 'common', 'basic', ['screenshot']],
    ['Cmd+Shift+5', 'Open screenshot/recording UI.', 'regular', 'basic', ['screenshot']],
    ['Cmd+Option+Esc', 'Force quit app.', 'regular', 'basic', ['system']],
    ['Cmd+Q', 'Quit app.', 'common', 'basic', ['app']],
    ['Cmd+W', 'Close window/tab.', 'common', 'basic', ['app']],
    ['Cmd+Shift+.', 'Toggle hidden files in Finder.', 'regular', 'intermediate', ['finder']],
    ['Cmd+Shift+N', 'Create folder in Finder.', 'regular', 'basic', ['finder']],
    ['Cmd+Delete', 'Move file to Trash.', 'regular', 'basic', ['finder']],
    ['Option+Cmd+V', 'Move file after copy.', 'rare', 'intermediate', ['finder']],
    ['Ctrl+Cmd+Q', 'Lock screen immediately.', 'regular', 'basic', ['security']],
    ['Cmd+,', 'Open app preferences.', 'regular', 'basic', ['app']],
    ['Cmd+H', 'Hide current app.', 'regular', 'basic', ['app']],
    ['Option+Cmd+H', 'Hide other apps.', 'rare', 'intermediate', ['app']],
    ['Cmd+Shift+3', 'Capture full-screen screenshot.', 'common', 'basic', ['screenshot']],
    ['Ctrl+Up', 'Mission Control.', 'regular', 'intermediate', ['desktop']],
    ['Ctrl+Down', 'App Expose.', 'rare', 'intermediate', ['desktop']],
    ['Ctrl+Left/Right', 'Switch spaces.', 'regular', 'intermediate', ['desktop']],
  ].map(([shortcut, description, usage, level, tags]) => ({ shortcut, description, usage, level, tags }));

  const gitEntries = [
    ['git status', 'Show working tree status.', 'common', 'basic', ['status']],
    ['git status -sb', 'Short status with branch.', 'common', 'basic', ['status']],
    ['git add <file>', 'Stage selected file.', 'common', 'basic', ['stage']],
    ['git add -A', 'Stage all modifications.', 'common', 'basic', ['stage']],
    ['git add -p', 'Interactively stage hunks.', 'regular', 'intermediate', ['stage']],
    ['git commit -m "msg"', 'Create commit with message.', 'common', 'basic', ['commit']],
    ['git commit --amend', 'Update latest commit.', 'regular', 'intermediate', ['commit']],
    ['git switch <branch>', 'Switch existing branch.', 'common', 'basic', ['branch']],
    ['git switch -c <branch>', 'Create and switch branch.', 'common', 'basic', ['branch']],
    ['git branch -vv', 'List branches with tracking.', 'regular', 'intermediate', ['branch']],
    ['git fetch --all --prune', 'Fetch and prune remotes.', 'regular', 'intermediate', ['sync']],
    ['git pull --rebase', 'Pull with rebase.', 'common', 'intermediate', ['sync']],
    ['git push', 'Push current branch.', 'common', 'basic', ['sync']],
    ['git push --force-with-lease', 'Safer force push.', 'rare', 'advanced', ['sync']],
    ['git merge <branch>', 'Merge branch into current.', 'regular', 'intermediate', ['merge']],
    ['git rebase -i HEAD~5', 'Interactive rebase for last commits.', 'rare', 'advanced', ['rebase']],
    ['git log --oneline --graph --decorate', 'Readable commit graph.', 'regular', 'intermediate', ['log']],
    ['git show <commit>', 'Show commit details.', 'regular', 'intermediate', ['log']],
    ['git diff', 'Diff unstaged changes.', 'common', 'basic', ['diff']],
    ['git diff --staged', 'Diff staged changes.', 'common', 'basic', ['diff']],
    ['git stash push -m "wip"', 'Stash working changes.', 'regular', 'intermediate', ['stash']],
    ['git stash list', 'List stashes.', 'regular', 'intermediate', ['stash']],
    ['git stash pop', 'Apply and drop stash.', 'regular', 'intermediate', ['stash']],
    ['git restore <file>', 'Restore file from HEAD.', 'regular', 'intermediate', ['restore']],
    ['git restore --staged <file>', 'Unstage file.', 'regular', 'intermediate', ['restore']],
    ['git cherry-pick <commit>', 'Apply selected commit on top.', 'rare', 'advanced', ['history']],
    ['git bisect start', 'Start bisect for regression hunt.', 'rare', 'advanced', ['debug']],
    ['git reflog', 'Show branch tip history.', 'rare', 'advanced', ['recovery']],
    ['git reset --soft HEAD~1', 'Undo commit and keep staged changes.', 'rare', 'advanced', ['history']],
    ['git tag -a v1.0.0 -m "release"', 'Create annotated tag.', 'regular', 'intermediate', ['release']],
    ['git blame <file>', 'Show line authorship.', 'regular', 'intermediate', ['debug']],
    ['git clean -fd', 'Remove untracked files/dirs.', 'rare', 'advanced', ['cleanup']],
    ['git worktree add ../feature-x feature/x', 'Create linked worktree.', 'rare', 'advanced', ['worktree']],
    ['git remote -v', 'List remotes.', 'regular', 'basic', ['remote']],
    ['git remote prune origin', 'Prune stale remote refs.', 'rare', 'advanced', ['remote']],
    ['git submodule update --init --recursive', 'Initialize and sync submodules.', 'rare', 'advanced', ['submodule']],
  ].map(([shortcut, description, usage, level, tags]) => ({
    shortcut,
    description,
    usage,
    level,
    tags,
    flags: [
      flag('--help', 'Show help for command.', '--help', 'basic', 'rare'),
      flag('--verbose', 'Verbose output when supported.', '--verbose', 'intermediate', 'regular'),
    ],
  }));

  const gitExtendedEntries = [
    ['git init', 'Initialize a new repository.', 'common', 'basic', ['setup']],
    ['git clone <url>', 'Clone repository from remote URL.', 'common', 'basic', ['setup']],
    ['git clone --depth 1 <url>', 'Shallow clone latest history only.', 'regular', 'intermediate', ['setup']],
    ['git config --global user.name "Your Name"', 'Set global git username.', 'common', 'basic', ['config']],
    ['git config --global user.email "you@example.com"', 'Set global git email.', 'common', 'basic', ['config']],
    ['git config --list --show-origin', 'Show effective git config with source files.', 'regular', 'intermediate', ['config']],
    ['git branch', 'List local branches.', 'common', 'basic', ['branch']],
    ['git branch -a', 'List local and remote branches.', 'regular', 'intermediate', ['branch']],
    ['git branch -d <branch>', 'Delete merged branch.', 'regular', 'intermediate', ['branch']],
    ['git branch -D <branch>', 'Force delete branch.', 'rare', 'advanced', ['branch']],
    ['git branch -m <new-name>', 'Rename current branch.', 'regular', 'intermediate', ['branch']],
    ['git switch --detach <commit>', 'Checkout detached HEAD at commit.', 'rare', 'advanced', ['branch']],
    ['git fetch origin <branch>', 'Fetch specific remote branch.', 'regular', 'intermediate', ['sync']],
    ['git pull --ff-only', 'Pull only if fast-forward possible.', 'regular', 'intermediate', ['sync']],
    ['git push -u origin <branch>', 'Push and set upstream branch.', 'common', 'basic', ['sync']],
    ['git push origin --delete <branch>', 'Delete remote branch.', 'regular', 'intermediate', ['sync']],
    ['git remote add origin <url>', 'Add named remote.', 'common', 'basic', ['remote']],
    ['git remote set-url origin <new-url>', 'Change remote URL.', 'regular', 'intermediate', ['remote']],
    ['git remote show origin', 'Inspect remote tracking info.', 'regular', 'intermediate', ['remote']],
    ['git log --stat', 'Commit log with changed files stats.', 'regular', 'intermediate', ['log']],
    ['git log --follow -- <file>', 'Follow history across renames for file.', 'regular', 'intermediate', ['log']],
    ['git shortlog -sn', 'Contributors sorted by commit count.', 'regular', 'intermediate', ['log']],
    ['git show --name-status <commit>', 'Show commit diff and changed files.', 'regular', 'intermediate', ['log']],
    ['git diff --name-only', 'List changed files only.', 'regular', 'basic', ['diff']],
    ['git diff --word-diff', 'Diff emphasizing changed words.', 'rare', 'advanced', ['diff']],
    ['git diff <a>..<b>', 'Diff two commit ranges.', 'regular', 'intermediate', ['diff']],
    ['git merge --no-ff <branch>', 'Create merge commit even for fast-forward.', 'regular', 'intermediate', ['merge']],
    ['git merge --abort', 'Abort current merge conflict session.', 'regular', 'intermediate', ['merge']],
    ['git rebase <base-branch>', 'Rebase current branch onto base.', 'regular', 'intermediate', ['rebase']],
    ['git rebase --continue', 'Continue rebase after conflict resolution.', 'regular', 'intermediate', ['rebase']],
    ['git rebase --abort', 'Abort current rebase operation.', 'regular', 'intermediate', ['rebase']],
    ['git cherry -v', 'Show commits not yet upstream.', 'rare', 'advanced', ['history']],
    ['git range-diff origin/main...HEAD', 'Compare commit range versions.', 'rare', 'advanced', ['history']],
    ['git revert <commit>', 'Create commit that reverts target commit.', 'regular', 'intermediate', ['history']],
    ['git reset --hard HEAD~1', 'Reset branch and working tree to previous commit.', 'rare', 'advanced', ['history']],
    ['git reset --mixed HEAD~1', 'Move HEAD and unstage changes.', 'rare', 'advanced', ['history']],
    ['git checkout --orphan <branch>', 'Create branch with no commit history.', 'rare', 'advanced', ['history']],
    ['git stash show -p stash@{0}', 'Show patch from stash entry.', 'rare', 'advanced', ['stash']],
    ['git stash branch <name> stash@{0}', 'Create branch from stash and apply it.', 'rare', 'advanced', ['stash']],
    ['git sparse-checkout init --cone', 'Enable sparse checkout mode.', 'rare', 'advanced', ['performance']],
    ['git sparse-checkout set <dir>', 'Checkout only selected directories.', 'rare', 'advanced', ['performance']],
    ['git gc --aggressive', 'Optimize repository storage aggressively.', 'rare', 'advanced', ['maintenance']],
    ['git fsck --full', 'Verify object database integrity.', 'rare', 'advanced', ['maintenance']],
    ['git pack-refs --all', 'Pack references for performance.', 'rare', 'advanced', ['maintenance']],
    ['git archive --format=zip HEAD > source.zip', 'Create source archive from HEAD.', 'regular', 'intermediate', ['release']],
    ['git describe --tags --always', 'Human-readable reference for current commit.', 'regular', 'intermediate', ['release']],
    ['git notes add -m "context"', 'Attach note metadata to commit.', 'rare', 'advanced', ['metadata']],
    ['git notes show <commit>', 'Show note attached to commit.', 'rare', 'advanced', ['metadata']],
    ['git rev-parse --short HEAD', 'Get short hash for current commit.', 'regular', 'basic', ['scripting']],
    ['git rev-list --count HEAD', 'Count commits in current branch.', 'rare', 'advanced', ['scripting']],
    ['git for-each-ref --sort=-committerdate refs/heads/', 'List branches by last commit date.', 'rare', 'advanced', ['scripting']],
    ['git update-index --assume-unchanged <file>', 'Temporarily ignore local modifications.', 'rare', 'advanced', ['index']],
    ['git update-index --no-assume-unchanged <file>', 'Undo assume-unchanged flag.', 'rare', 'advanced', ['index']],
    ['git ls-files', 'List tracked files in index.', 'regular', 'intermediate', ['index']],
    ['git ls-tree -r HEAD --name-only', 'List files in current tree.', 'regular', 'intermediate', ['index']],
    ['git cat-file -p <object>', 'Inspect raw git object.', 'rare', 'advanced', ['plumbing']],
    ['git hash-object -w <file>', 'Write file as blob object.', 'rare', 'advanced', ['plumbing']],
    ['git symbolic-ref --short HEAD', 'Get symbolic ref name of HEAD.', 'regular', 'intermediate', ['plumbing']],
  ].map(([shortcut, description, usage, level, tags]) => ({
    shortcut,
    description,
    usage,
    level,
    tags,
    flags: [
      flag('--help', 'Show help for command.', '--help', 'basic', 'rare'),
      flag('--verbose', 'Verbose output when supported.', '--verbose', 'intermediate', 'regular'),
    ],
  }));

  const shellEntries = [
    ['Ctrl+a', 'Move cursor to beginning of line.', 'common', 'basic', ['navigation'], false],
    ['Ctrl+e', 'Move cursor to end of line.', 'common', 'basic', ['navigation'], false],
    ['Ctrl+r', 'Search command history.', 'common', 'basic', ['history'], false],
    ['Ctrl+w', 'Delete previous word.', 'common', 'basic', ['editing'], false],
    ['Ctrl+u', 'Delete to start of line.', 'common', 'basic', ['editing'], false],
    ['Ctrl+k', 'Delete to end of line.', 'common', 'basic', ['editing'], false],
    ['!!', 'Run previous command.', 'common', 'basic', ['history'], false],
    ['!$', 'Use last argument from previous command.', 'regular', 'intermediate', ['history'], false],
    ['history 30', 'Show last commands.', 'regular', 'basic', ['history'], true],
    ['fc -l -20', 'List recent history with event numbers.', 'rare', 'advanced', ['history'], true],
    ['source ~/.zshrc', 'Reload zsh configuration.', 'common', 'basic', ['config'], true],
    ['alias gs="git status -sb"', 'Define shell alias.', 'regular', 'basic', ['productivity'], true],
    ['unalias gs', 'Remove shell alias.', 'rare', 'basic', ['productivity'], true],
    ['set -o vi', 'Enable vi keybindings in shell.', 'rare', 'intermediate', ['editing'], true],
    ['bindkey -v', 'Enable vi mode in zsh.', 'rare', 'intermediate', ['editing'], true],
    ['export PATH="$HOME/bin:$PATH"', 'Prepend custom bin directory.', 'regular', 'intermediate', ['env'], true],
    ['printenv | sort', 'Inspect sorted environment variables.', 'regular', 'intermediate', ['env'], true],
    ['typeset -p VAR', 'Print variable declaration in zsh.', 'rare', 'advanced', ['env'], true],
    ['set -eu', 'Exit on error and unset variables.', 'rare', 'advanced', ['scripting'], true],
    ['set -o pipefail', 'Fail pipeline if any command fails.', 'rare', 'advanced', ['scripting'], true],
    ['xargs -0 -n1', 'Read null-separated input safely.', 'rare', 'advanced', ['pipeline'], true],
    ['printf "%s\n" "$var"', 'Reliable shell string output.', 'regular', 'intermediate', ['scripting'], true],
    ['trap "cleanup" EXIT', 'Run cleanup function on exit.', 'rare', 'advanced', ['scripting'], true],
  ].map(([shortcut, description, usage, level, tags, expand]) => ({
    shortcut,
    description,
    usage,
    level,
    tags,
    expandFlags: Boolean(expand),
    flags: [
      flag('--help', 'Show command help if supported.', '--help', 'basic', 'rare'),
      flag('--version', 'Print tool version if supported.', '--version', 'basic', 'rare'),
    ],
  }));

  const shellExtendedEntries = [
    ['pwd', 'Print current working directory.', 'common', 'basic', ['navigation'], true],
    ['cd -', 'Switch to previous directory.', 'common', 'basic', ['navigation'], true],
    ['pushd /path', 'Push directory stack and switch.', 'regular', 'intermediate', ['navigation'], true],
    ['popd', 'Pop directory stack and switch back.', 'regular', 'intermediate', ['navigation'], true],
    ['dirs -v', 'Display directory stack.', 'rare', 'intermediate', ['navigation'], true],
    ['which <cmd>', 'Locate executable in PATH.', 'common', 'basic', ['introspection'], true],
    ['command -v <cmd>', 'Shell-safe command resolution.', 'regular', 'intermediate', ['introspection'], true],
    ['type <cmd>', 'Describe command type (builtin/function/file).', 'regular', 'intermediate', ['introspection'], true],
    ['jobs -l', 'List background jobs with PIDs.', 'regular', 'intermediate', ['jobs'], true],
    ['bg %1', 'Resume job in background.', 'regular', 'intermediate', ['jobs'], true],
    ['fg %1', 'Bring job to foreground.', 'regular', 'intermediate', ['jobs'], true],
    ['disown %1', 'Detach job from current shell.', 'rare', 'advanced', ['jobs'], true],
    ['wait <pid>', 'Wait for process completion.', 'regular', 'intermediate', ['jobs'], true],
    ['read -r line', 'Read user input safely into variable.', 'regular', 'intermediate', ['scripting'], true],
    ['read -s password', 'Read silent input without echo.', 'regular', 'intermediate', ['scripting'], true],
    ['for f in *.log; do echo \"$f\"; done', 'Loop over matching files.', 'regular', 'intermediate', ['scripting'], true],
    ['for i in {1..10}; do echo $i; done', 'Brace expansion loop example.', 'regular', 'intermediate', ['scripting'], true],
    ['while read -r line; do ...; done < file', 'Read file line-by-line safely.', 'rare', 'advanced', ['scripting'], true],
    ['case \"$var\" in prod) ... ;; esac', 'Pattern-based branching in shell.', 'regular', 'intermediate', ['scripting'], true],
    ['[[ -f file ]] && echo yes', 'Conditional file existence test.', 'common', 'basic', ['scripting'], true],
    ['[[ -n \"$var\" ]]', 'Test non-empty variable.', 'common', 'basic', ['scripting'], true],
    ['[[ \"$a\" =~ regex ]]', 'Regex match in shell condition.', 'rare', 'advanced', ['scripting'], true],
    ['set -x', 'Trace commands during script execution.', 'regular', 'intermediate', ['debug'], true],
    ['set +x', 'Disable command tracing.', 'regular', 'intermediate', ['debug'], true],
    ['PS4=\"+ ${BASH_SOURCE}:${LINENO}:${FUNCNAME[0]}: \"', 'Improve shell trace output with context.', 'rare', 'advanced', ['debug'], true],
    ['declare -A map', 'Define associative array in bash.', 'rare', 'advanced', ['scripting'], true],
    ['compgen -c', 'List available shell commands.', 'rare', 'advanced', ['introspection'], true],
    ['builtin cd /tmp', 'Force use of builtin command.', 'rare', 'advanced', ['introspection'], true],
    ['hash -r', 'Clear command location hash cache.', 'regular', 'intermediate', ['introspection'], true],
    ['exec > >(tee out.log) 2>&1', 'Redirect script stdout/stderr to tee.', 'rare', 'advanced', ['scripting'], true],
    ['mktemp -d', 'Create secure temporary directory.', 'regular', 'intermediate', ['filesystem'], true],
    ['umask 027', 'Set default file mode mask.', 'regular', 'intermediate', ['security'], true],
    ['stty -a', 'Inspect terminal settings.', 'rare', 'advanced', ['terminal'], true],
    ['stty sane', 'Reset broken terminal state.', 'regular', 'intermediate', ['terminal'], true],
    ['zmodload zsh/zprof', 'Enable zsh profiling module.', 'rare', 'advanced', ['zsh'], true],
    ['zprof', 'Show zsh startup/profile timings.', 'rare', 'advanced', ['zsh'], true],
    ['autoload -Uz compinit && compinit', 'Initialize zsh completion system.', 'regular', 'intermediate', ['zsh'], true],
    ['bindkey \"^R\" history-incremental-search-backward', 'Bind reverse history search in zsh.', 'rare', 'advanced', ['zsh'], true],
    ['setopt autocd', 'Enable automatic directory cd in zsh.', 'rare', 'intermediate', ['zsh'], true],
    ['setopt HIST_IGNORE_DUPS', 'Avoid duplicate history entries.', 'regular', 'intermediate', ['zsh'], true],
    ['fc -s', 'Re-run previous command from editor/history.', 'rare', 'advanced', ['history'], true],
    ['history -E 1', 'Show history with timestamps (zsh).', 'rare', 'advanced', ['history'], true],
    ['time <command>', 'Measure command runtime.', 'regular', 'basic', ['performance'], true],
    ['ulimit -a', 'Inspect shell resource limits.', 'rare', 'advanced', ['system'], true],
  ].map(([shortcut, description, usage, level, tags, expand]) => ({
    shortcut,
    description,
    usage,
    level,
    tags,
    expandFlags: Boolean(expand),
    flags: [
      flag('--help', 'Show command help if supported.', '--help', 'basic', 'rare'),
      flag('--version', 'Print tool version if supported.', '--version', 'basic', 'rare'),
    ],
  }));

  const linuxEntries = [
    ['cd <path>', 'Change current directory to a target path.', 'common', 'basic', ['navigation']],
    ['cd ~', 'Jump to home directory.', 'common', 'basic', ['navigation']],
    ['pwd', 'Print current working directory.', 'common', 'basic', ['navigation']],
    ['mkdir -p <dir>', 'Create directory recursively if missing.', 'common', 'basic', ['filesystem']],
    ['ls -lah', 'List files with hidden entries and sizes.', 'common', 'basic', ['files']],
    ['find . -name "*.log"', 'Find files by pattern.', 'common', 'basic', ['search']],
    ['grep -R "pattern" .', 'Search recursively in files.', 'common', 'basic', ['search']],
    ['rg "pattern"', 'Fast recursive text search.', 'common', 'basic', ['search']],
    ['sed -n "1,120p" file', 'Print selected lines.', 'regular', 'intermediate', ['text']],
    ['awk "{print $1}" file', 'Print first column.', 'regular', 'intermediate', ['text']],
    ['cut -d, -f1 file.csv', 'Extract CSV column.', 'regular', 'intermediate', ['text']],
    ['sort file | uniq -c', 'Count unique lines.', 'regular', 'intermediate', ['text']],
    ['xargs -I{} echo {}', 'Apply command to piped items.', 'regular', 'intermediate', ['pipeline']],
    ['chmod +x script.sh', 'Make script executable.', 'common', 'basic', ['permissions']],
    ['chown user:group file', 'Change file owner.', 'regular', 'intermediate', ['permissions']],
    ['tar -czf archive.tgz dir/', 'Create gzip tar archive.', 'regular', 'intermediate', ['archive']],
    ['tar -xzf archive.tgz', 'Extract gzip archive.', 'regular', 'intermediate', ['archive']],
    ['zip -r archive.zip dir/', 'Create zip archive.', 'regular', 'basic', ['archive']],
    ['unzip archive.zip', 'Extract zip archive.', 'regular', 'basic', ['archive']],
    ['df -h', 'Show disk usage by mount.', 'common', 'basic', ['system']],
    ['du -sh *', 'Summarize directory sizes.', 'regular', 'basic', ['system']],
    ['free -h', 'Show memory usage.', 'common', 'basic', ['system']],
    ['top', 'Interactive process monitor.', 'common', 'basic', ['system']],
    ['htop', 'Enhanced process monitor.', 'regular', 'basic', ['system']],
    ['ps aux | grep process', 'Find process details.', 'regular', 'intermediate', ['process']],
    ['kill -15 <pid>', 'Gracefully terminate process.', 'regular', 'intermediate', ['process']],
    ['kill -9 <pid>', 'Force kill process.', 'rare', 'advanced', ['process']],
    ['systemctl status <service>', 'Service status on systemd.', 'regular', 'intermediate', ['service']],
    ['systemctl restart <service>', 'Restart service.', 'regular', 'intermediate', ['service']],
    ['journalctl -u <service> -n 100', 'Tail service logs.', 'regular', 'intermediate', ['logs']],
    ['ip a', 'List network interfaces.', 'regular', 'intermediate', ['network']],
    ['ss -tulpn', 'List open ports and processes.', 'regular', 'intermediate', ['network']],
    ['curl -I https://example.com', 'Fetch HTTP headers.', 'common', 'basic', ['http']],
    ['curl -sSfL <url>', 'Silent fetch with fail on errors.', 'regular', 'intermediate', ['http']],
    ['wget <url>', 'Download file from URL.', 'regular', 'basic', ['http']],
    ['ssh user@host', 'Open SSH session.', 'common', 'basic', ['ssh']],
    ['ssh -i key.pem user@host', 'SSH with explicit key.', 'regular', 'intermediate', ['ssh']],
    ['scp file user@host:/path', 'Copy file via SSH.', 'regular', 'intermediate', ['ssh']],
    ['rsync -avz src/ dest/', 'Sync dirs with compression.', 'regular', 'intermediate', ['sync']],
    ['mount | column -t', 'Pretty print mounted filesystems.', 'rare', 'advanced', ['system']],
    ['uptime', 'Show uptime and load average.', 'regular', 'basic', ['system']],
    ['crontab -e', 'Edit user cron jobs.', 'regular', 'intermediate', ['schedule']],
    ['crontab -l', 'List user cron jobs.', 'regular', 'intermediate', ['schedule']],
    ['watch -n 2 "df -h"', 'Run command repeatedly.', 'regular', 'intermediate', ['monitoring']],
  ].map(([shortcut, description, usage, level, tags]) => ({
    shortcut,
    description,
    usage,
    level,
    tags,
    flags: [
      flag('--help', 'Show command help.', '--help', 'basic', 'rare'),
      flag('--verbose', 'Verbose output when available.', '--verbose', 'intermediate', 'rare'),
    ],
  }));

  const linuxExtendedEntries = [
    ['ls -lt', 'Sort files by modification time.', 'common', 'basic', ['files']],
    ['ls -R', 'List files recursively.', 'regular', 'basic', ['files']],
    ['tree -L 2', 'Show directory tree up to depth 2.', 'regular', 'basic', ['files']],
    ['stat file', 'Show detailed file metadata.', 'regular', 'intermediate', ['files']],
    ['file bin/app', 'Detect file type.', 'regular', 'basic', ['files']],
    ['realpath ./relative/path', 'Resolve absolute canonical path.', 'regular', 'intermediate', ['files']],
    ['basename /path/file.txt', 'Extract filename from path.', 'regular', 'basic', ['text']],
    ['dirname /path/file.txt', 'Extract directory path.', 'regular', 'basic', ['text']],
    ['head -n 50 file', 'Read first 50 lines.', 'common', 'basic', ['text']],
    ['tail -n 50 file', 'Read last 50 lines.', 'common', 'basic', ['text']],
    ['tail -f /var/log/app.log', 'Follow file changes in real time.', 'common', 'basic', ['logs']],
    ['less +F file.log', 'Follow file in less continuously.', 'regular', 'intermediate', ['logs']],
    ['wc -l file', 'Count number of lines.', 'regular', 'basic', ['text']],
    ['paste -d, file1 file2', 'Merge files column-wise.', 'rare', 'intermediate', ['text']],
    ['tr \"[:lower:]\" \"[:upper:]\" < file', 'Transform lowercase to uppercase.', 'regular', 'intermediate', ['text']],
    ['jq \".items[] | .name\" data.json', 'Extract fields from JSON.', 'regular', 'intermediate', ['json']],
    ['yq \".spec.template\" deployment.yaml', 'Extract YAML fields with yq.', 'regular', 'intermediate', ['yaml']],
    ['cut -f1 -d: /etc/passwd', 'Extract username field from passwd.', 'regular', 'intermediate', ['text']],
    ['sort -u file', 'Sort and deduplicate lines.', 'regular', 'basic', ['text']],
    ['comm -12 a.txt b.txt', 'Show shared lines between sorted files.', 'rare', 'advanced', ['text']],
    ['diff -u old new', 'Unified diff between files.', 'regular', 'basic', ['diff']],
    ['cmp -l file1 file2', 'Byte-by-byte differences.', 'rare', 'advanced', ['diff']],
    ['ln -s target link', 'Create symbolic link.', 'regular', 'basic', ['filesystem']],
    ['readlink -f link', 'Resolve symlink target path.', 'regular', 'intermediate', ['filesystem']],
    ['find . -type f -mtime -1', 'Find files modified in last day.', 'regular', 'intermediate', ['search']],
    ['find . -type f -size +100M', 'Find large files.', 'regular', 'intermediate', ['search']],
    ['find . -type f -print0 | xargs -0 rm', 'Delete matched files safely (null-separated).', 'rare', 'advanced', ['search']],
    ['locate nginx.conf', 'Fast file lookup using locate db.', 'regular', 'basic', ['search']],
    ['updatedb', 'Update locate file database.', 'rare', 'advanced', ['search']],
    ['grep -n \"TODO\" file', 'Show matching lines with line numbers.', 'common', 'basic', ['search']],
    ['grep -E \"foo|bar\" file', 'Extended regex grep.', 'regular', 'intermediate', ['search']],
    ['grep -v \"^#\" config', 'Invert match to skip comments.', 'regular', 'intermediate', ['search']],
    ['rg --files | rg \"\\.ts$\"', 'Find TypeScript files with ripgrep.', 'regular', 'intermediate', ['search']],
    ['sed -i \"s/foo/bar/g\" file', 'Edit file in-place replacing text.', 'regular', 'intermediate', ['text']],
    ['awk -F, \"{sum+=$3} END {print sum}\" file.csv', 'Aggregate numeric CSV column.', 'rare', 'advanced', ['text']],
    ['printf \"%(%F %T)T\\n\" -1', 'Print current date-time via printf.', 'rare', 'advanced', ['text']],
    ['env', 'Print environment variables.', 'common', 'basic', ['env']],
    ['export VAR=value', 'Set environment variable.', 'common', 'basic', ['env']],
    ['unset VAR', 'Remove environment variable.', 'regular', 'basic', ['env']],
    ['sudo -l', 'List allowed sudo commands.', 'regular', 'intermediate', ['security']],
    ['id', 'Show current user and group IDs.', 'regular', 'basic', ['security']],
    ['whoami', 'Print current username.', 'common', 'basic', ['security']],
    ['groups', 'List current user groups.', 'regular', 'basic', ['security']],
    ['getent passwd <user>', 'Resolve user entry from NSS.', 'rare', 'advanced', ['security']],
    ['passwd', 'Change current user password.', 'regular', 'basic', ['security']],
    ['chgrp staff file', 'Change file group ownership.', 'regular', 'basic', ['permissions']],
    ['chmod 640 file', 'Set explicit file permissions.', 'common', 'basic', ['permissions']],
    ['setfacl -m u:user:r file', 'Add POSIX ACL permission.', 'rare', 'advanced', ['permissions']],
    ['getfacl file', 'Inspect ACL permissions.', 'rare', 'advanced', ['permissions']],
    ['ip route', 'Show routing table.', 'regular', 'intermediate', ['network']],
    ['ip link show', 'List network links.', 'regular', 'intermediate', ['network']],
    ['ping -c 4 8.8.8.8', 'Send ICMP probes.', 'common', 'basic', ['network']],
    ['traceroute example.com', 'Trace packet path hops.', 'regular', 'intermediate', ['network']],
    ['dig +short example.com', 'Resolve DNS quickly.', 'regular', 'intermediate', ['network']],
    ['nslookup example.com', 'Query DNS records.', 'regular', 'basic', ['network']],
    ['nc -zv host 443', 'Check remote TCP port connectivity.', 'regular', 'intermediate', ['network']],
    ['lsof -i :3000', 'Find process using a port.', 'regular', 'intermediate', ['network']],
    ['tcpdump -i any port 443', 'Capture packets on interface.', 'rare', 'advanced', ['network']],
    ['curl -X POST -H \"Content-Type: application/json\" -d \"{}\" https://api', 'Send JSON POST request.', 'regular', 'intermediate', ['http']],
    ['curl --retry 3 --retry-delay 2 <url>', 'Retry transient HTTP requests.', 'regular', 'intermediate', ['http']],
    ['openssl s_client -connect host:443', 'Inspect TLS handshake/cert chain.', 'rare', 'advanced', ['network']],
    ['ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head', 'Top CPU-consuming processes.', 'regular', 'intermediate', ['process']],
    ['pgrep -fa process', 'Search processes by pattern.', 'regular', 'intermediate', ['process']],
    ['pkill -f process', 'Kill processes by pattern.', 'regular', 'intermediate', ['process']],
    ['nohup command > out.log 2>&1 &', 'Run command detached from terminal.', 'regular', 'intermediate', ['process']],
    ['nice -n 10 command', 'Run command with lower priority.', 'rare', 'advanced', ['process']],
    ['renice +5 -p <pid>', 'Adjust priority of running process.', 'rare', 'advanced', ['process']],
    ['systemctl list-units --type=service', 'List loaded services.', 'regular', 'intermediate', ['service']],
    ['systemctl enable <service>', 'Enable service at boot.', 'regular', 'intermediate', ['service']],
    ['systemctl disable <service>', 'Disable service at boot.', 'regular', 'intermediate', ['service']],
    ['journalctl -xe', 'Show detailed recent journal entries.', 'regular', 'intermediate', ['logs']],
    ['journalctl --since \"1 hour ago\"', 'Journal entries from recent period.', 'regular', 'intermediate', ['logs']],
    ['dmesg | tail -n 50', 'Show latest kernel messages.', 'regular', 'intermediate', ['logs']],
    ['tar -tvf archive.tgz', 'List files inside tar archive.', 'regular', 'intermediate', ['archive']],
    ['gzip -9 file', 'Compress file with max compression.', 'regular', 'basic', ['archive']],
    ['gunzip file.gz', 'Decompress gzip file.', 'regular', 'basic', ['archive']],
    ['split -l 10000 bigfile part_', 'Split file by line count.', 'regular', 'intermediate', ['archive']],
    ['sha256sum file', 'Compute SHA256 checksum.', 'regular', 'basic', ['security']],
    ['md5sum file', 'Compute MD5 checksum (legacy).', 'rare', 'basic', ['security']],
    ['date -u +\"%Y-%m-%dT%H:%M:%SZ\"', 'Print UTC ISO-like timestamp.', 'regular', 'basic', ['system']],
    ['timedatectl status', 'Inspect system time and NTP state.', 'regular', 'intermediate', ['system']],
    ['uname -a', 'Print kernel/system information.', 'common', 'basic', ['system']],
    ['hostnamectl', 'Show host metadata.', 'regular', 'intermediate', ['system']],
    ['lsblk', 'List block storage devices.', 'regular', 'intermediate', ['system']],
    ['blkid', 'Show block device UUID and filesystem type.', 'rare', 'advanced', ['system']],
    ['mount /dev/sdb1 /mnt/data', 'Mount a block device.', 'rare', 'advanced', ['system']],
    ['umount /mnt/data', 'Unmount filesystem.', 'rare', 'advanced', ['system']],
    ['sync', 'Flush filesystem buffers to disk.', 'rare', 'advanced', ['system']],
    ['screen -ls', 'List GNU screen sessions.', 'rare', 'intermediate', ['terminal']],
    ['screen -S name', 'Create named screen session.', 'rare', 'intermediate', ['terminal']],
    ['tmux new -As main', 'Attach or create tmux session.', 'regular', 'intermediate', ['terminal']],
  ].map(([shortcut, description, usage, level, tags]) => ({
    shortcut,
    description,
    usage,
    level,
    tags,
    flags: [
      flag('--help', 'Show command help.', '--help', 'basic', 'rare'),
      flag('--verbose', 'Verbose output when available.', '--verbose', 'intermediate', 'rare'),
    ],
  }));

  const gcloudCore = [];
  function addGcloud(shortcut, description, usage, level, tags, extraFlags, examples) {
    gcloudCore.push({
      shortcut,
      description,
      usage,
      level,
      tags,
      flags: extraFlags || [],
      examples: examples || [],
    });
  }

  [
    ['gcloud auth login', 'Authenticate local user.', 'common', 'basic', ['auth']],
    ['gcloud auth application-default login', 'Set ADC credentials for SDKs.', 'regular', 'intermediate', ['auth']],
    ['gcloud config list', 'Show active configuration.', 'common', 'basic', ['config']],
    ['gcloud config set project <project-id>', 'Set default project.', 'common', 'basic', ['config']],
    ['gcloud projects list', 'List available projects.', 'regular', 'basic', ['project']],
    ['gcloud services list --enabled', 'List enabled APIs.', 'regular', 'intermediate', ['api']],
  ].forEach((row) => addGcloud(...row));

  const gcloudFamilies = [
    {
      base: 'gcloud compute instances',
      tag: 'compute',
      actions: [
        ['list', 'List compute instances.', 'common', 'basic'],
        ['describe <instance> --zone <zone>', 'Describe instance metadata.', 'regular', 'intermediate'],
        ['create <instance> --zone <zone>', 'Create new VM instance.', 'regular', 'intermediate'],
        ['delete <instance> --zone <zone>', 'Delete VM instance.', 'regular', 'intermediate'],
        ['start <instance> --zone <zone>', 'Start stopped instance.', 'regular', 'basic'],
        ['stop <instance> --zone <zone>', 'Stop running instance.', 'regular', 'basic'],
        ['reset <instance> --zone <zone>', 'Hard reset instance.', 'rare', 'advanced'],
        ['ssh <instance> --zone <zone>', 'SSH into instance.', 'common', 'basic'],
      ],
    },
    {
      base: 'gcloud compute disks',
      tag: 'compute',
      actions: [
        ['list', 'List persistent disks.', 'regular', 'basic'],
        ['describe <disk> --zone <zone>', 'Describe disk.', 'regular', 'intermediate'],
        ['create <disk> --size=100GB --zone <zone>', 'Create new disk.', 'regular', 'intermediate'],
        ['delete <disk> --zone <zone>', 'Delete disk.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud compute firewall-rules',
      tag: 'network',
      actions: [
        ['list', 'List firewall rules.', 'regular', 'basic'],
        ['describe <rule>', 'Describe firewall rule.', 'regular', 'intermediate'],
        ['create <rule> --allow tcp:80', 'Create firewall rule.', 'regular', 'intermediate'],
        ['delete <rule>', 'Delete firewall rule.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud container clusters',
      tag: 'gke',
      actions: [
        ['list', 'List GKE clusters.', 'regular', 'basic'],
        ['describe <cluster> --zone <zone>', 'Describe cluster.', 'regular', 'intermediate'],
        ['create <cluster> --num-nodes=3 --zone <zone>', 'Create cluster.', 'regular', 'intermediate'],
        ['delete <cluster> --zone <zone>', 'Delete cluster.', 'regular', 'intermediate'],
        ['get-credentials <cluster> --zone <zone>', 'Get kubectl credentials.', 'common', 'basic'],
      ],
    },
    {
      base: 'gcloud run services',
      tag: 'run',
      actions: [
        ['list', 'List Cloud Run services.', 'common', 'basic'],
        ['describe <service> --region <region>', 'Describe service.', 'regular', 'intermediate'],
        ['update <service> --image <image>', 'Update deployed image.', 'regular', 'intermediate'],
        ['delete <service> --region <region>', 'Delete service.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud functions',
      tag: 'functions',
      actions: [
        ['list', 'List cloud functions.', 'regular', 'basic'],
        ['describe <function> --region <region>', 'Describe function.', 'regular', 'intermediate'],
        ['deploy <function> --runtime nodejs20 --trigger-http', 'Deploy function.', 'regular', 'advanced'],
        ['delete <function> --region <region>', 'Delete function.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud pubsub topics',
      tag: 'pubsub',
      actions: [
        ['list', 'List Pub/Sub topics.', 'regular', 'basic'],
        ['create <topic>', 'Create topic.', 'regular', 'basic'],
        ['delete <topic>', 'Delete topic.', 'regular', 'basic'],
      ],
    },
    {
      base: 'gcloud pubsub subscriptions',
      tag: 'pubsub',
      actions: [
        ['list', 'List Pub/Sub subscriptions.', 'regular', 'basic'],
        ['create <sub> --topic <topic>', 'Create subscription.', 'regular', 'intermediate'],
        ['delete <sub>', 'Delete subscription.', 'regular', 'basic'],
      ],
    },
    {
      base: 'gcloud sql instances',
      tag: 'sql',
      actions: [
        ['list', 'List Cloud SQL instances.', 'regular', 'basic'],
        ['describe <instance>', 'Describe SQL instance.', 'regular', 'intermediate'],
        ['create <instance> --database-version=POSTGRES_15', 'Create SQL instance.', 'rare', 'advanced'],
        ['delete <instance>', 'Delete SQL instance.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud iam service-accounts',
      tag: 'iam',
      actions: [
        ['list', 'List service accounts.', 'regular', 'basic'],
        ['create <name> --display-name "Name"', 'Create service account.', 'regular', 'intermediate'],
        ['delete <email>', 'Delete service account.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud storage buckets',
      tag: 'storage',
      actions: [
        ['list', 'List storage buckets.', 'regular', 'basic'],
        ['create gs://<bucket> --location=US', 'Create storage bucket.', 'regular', 'intermediate'],
        ['describe gs://<bucket>', 'Describe storage bucket.', 'regular', 'intermediate'],
        ['delete gs://<bucket>', 'Delete storage bucket.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud storage cp',
      tag: 'storage',
      actions: [
        ['file gs://<bucket>/', 'Copy file to bucket.', 'common', 'basic'],
        ['gs://<bucket>/file ./', 'Copy file from bucket.', 'common', 'basic'],
      ],
    },
  ];

  gcloudFamilies.push(
    {
      base: 'gcloud artifacts repositories',
      tag: 'artifact-registry',
      actions: [
        ['list --location <region>', 'List Artifact Registry repositories.', 'regular', 'intermediate'],
        ['describe <repo> --location <region>', 'Describe repository.', 'regular', 'intermediate'],
        ['create <repo> --repository-format=docker --location <region>', 'Create repository.', 'rare', 'advanced'],
        ['delete <repo> --location <region>', 'Delete repository.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud secrets',
      tag: 'secret-manager',
      actions: [
        ['list', 'List secrets.', 'regular', 'basic'],
        ['create <name> --replication-policy=automatic', 'Create secret.', 'regular', 'intermediate'],
        ['versions add <name> --data-file=secret.txt', 'Add secret version.', 'regular', 'intermediate'],
        ['versions access latest --secret=<name>', 'Read latest secret version.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud scheduler jobs',
      tag: 'scheduler',
      actions: [
        ['list --location <region>', 'List Cloud Scheduler jobs.', 'regular', 'basic'],
        ['describe <job> --location <region>', 'Describe scheduled job.', 'regular', 'intermediate'],
        ['run <job> --location <region>', 'Manually trigger scheduled job.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud builds',
      tag: 'cloud-build',
      actions: [
        ['list', 'List Cloud Build runs.', 'regular', 'basic'],
        ['describe <build-id>', 'Describe build details.', 'regular', 'intermediate'],
        ['submit --tag <image>', 'Build container image from source.', 'regular', 'intermediate'],
        ['triggers list', 'List Cloud Build triggers.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud logging',
      tag: 'logging',
      actions: [
        ['logs list', 'List log names in project.', 'regular', 'intermediate'],
        ['read \"resource.type=gce_instance\" --limit 20', 'Read logs with filter.', 'regular', 'intermediate'],
        ['sinks list', 'List log sinks.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud monitoring channels',
      tag: 'monitoring',
      actions: [
        ['list', 'List notification channels.', 'regular', 'intermediate'],
        ['describe <channel-id>', 'Describe notification channel.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'gcloud dns managed-zones',
      tag: 'dns',
      actions: [
        ['list', 'List Cloud DNS managed zones.', 'regular', 'basic'],
        ['describe <zone>', 'Describe DNS managed zone.', 'regular', 'intermediate'],
        ['create <zone> --dns-name example.com. --visibility public', 'Create DNS managed zone.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'gcloud redis instances',
      tag: 'redis',
      actions: [
        ['list --region <region>', 'List Memorystore Redis instances.', 'regular', 'basic'],
        ['describe <instance> --region <region>', 'Describe Redis instance.', 'regular', 'intermediate'],
        ['create <instance> --region <region> --size 1', 'Create Redis instance.', 'rare', 'advanced'],
      ],
    },
  );

  gcloudFamilies.forEach((family) => {
    family.actions.forEach((action) => {
      addGcloud(`${family.base} ${action[0]}`, action[1], action[2], action[3], [family.tag]);
    });
  });

  const awsCore = [];
  function addAws(shortcut, description, usage, level, tags, flags) {
    awsCore.push({ shortcut, description, usage, level, tags, flags: flags || [] });
  }

  [
    ['aws configure', 'Set AWS credentials/profile.', 'common', 'basic', ['auth']],
    ['aws sts get-caller-identity', 'Show active IAM identity.', 'common', 'basic', ['auth']],
    ['aws iam list-users', 'List IAM users.', 'regular', 'basic', ['iam']],
    ['aws iam list-roles', 'List IAM roles.', 'regular', 'basic', ['iam']],
    ['aws s3 ls', 'List S3 buckets.', 'common', 'basic', ['s3']],
    ['aws s3 cp file s3://bucket/', 'Copy file to S3 bucket.', 'common', 'basic', ['s3']],
    ['aws s3 sync ./dist s3://bucket/', 'Sync directory to S3.', 'regular', 'intermediate', ['s3']],
  ].forEach((row) => addAws(...row));

  const awsFamilies = [
    {
      base: 'aws ec2',
      tag: 'ec2',
      actions: [
        ['describe-instances', 'Describe EC2 instances.', 'common', 'basic'],
        ['describe-volumes', 'Describe EBS volumes.', 'regular', 'intermediate'],
        ['start-instances --instance-ids <id>', 'Start EC2 instance.', 'regular', 'basic'],
        ['stop-instances --instance-ids <id>', 'Stop EC2 instance.', 'regular', 'basic'],
        ['terminate-instances --instance-ids <id>', 'Terminate EC2 instance.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws ecs',
      tag: 'ecs',
      actions: [
        ['list-clusters', 'List ECS clusters.', 'regular', 'basic'],
        ['list-services --cluster <cluster>', 'List services in ECS cluster.', 'regular', 'intermediate'],
        ['describe-services --cluster <cluster> --services <svc>', 'Describe ECS service.', 'regular', 'intermediate'],
        ['update-service --cluster <cluster> --service <svc> --force-new-deployment', 'Roll ECS service deployment.', 'regular', 'advanced'],
      ],
    },
    {
      base: 'aws eks',
      tag: 'eks',
      actions: [
        ['list-clusters', 'List EKS clusters.', 'regular', 'basic'],
        ['describe-cluster --name <cluster>', 'Describe EKS cluster.', 'regular', 'intermediate'],
        ['update-kubeconfig --name <cluster>', 'Update local kubeconfig from EKS.', 'common', 'intermediate'],
      ],
    },
    {
      base: 'aws lambda',
      tag: 'lambda',
      actions: [
        ['list-functions', 'List Lambda functions.', 'regular', 'basic'],
        ['get-function --function-name <name>', 'Describe Lambda function.', 'regular', 'intermediate'],
        ['invoke --function-name <name> out.json', 'Invoke Lambda and save output.', 'regular', 'intermediate'],
        ['update-function-code --function-name <name> --zip-file fileb://function.zip', 'Update Lambda code package.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'aws cloudformation',
      tag: 'cloudformation',
      actions: [
        ['list-stacks', 'List CloudFormation stacks.', 'regular', 'basic'],
        ['describe-stacks --stack-name <stack>', 'Describe stack.', 'regular', 'intermediate'],
        ['deploy --template-file template.yml --stack-name <stack>', 'Deploy stack changes.', 'regular', 'advanced'],
        ['delete-stack --stack-name <stack>', 'Delete stack.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws rds',
      tag: 'rds',
      actions: [
        ['describe-db-instances', 'List RDS instances.', 'regular', 'basic'],
        ['create-db-snapshot --db-instance-identifier <db> --db-snapshot-identifier <snap>', 'Create DB snapshot.', 'rare', 'advanced'],
        ['describe-db-snapshots --db-instance-identifier <db>', 'List DB snapshots.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws dynamodb',
      tag: 'dynamodb',
      actions: [
        ['list-tables', 'List DynamoDB tables.', 'regular', 'basic'],
        ['describe-table --table-name <table>', 'Describe table.', 'regular', 'intermediate'],
        ['scan --table-name <table>', 'Scan all table items.', 'rare', 'advanced'],
        ['query --table-name <table> --key-condition-expression "pk=:v" --expression-attribute-values ":v={\"S\":\"id\"}"', 'Query items by key.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'aws logs',
      tag: 'logs',
      actions: [
        ['describe-log-groups', 'List CloudWatch log groups.', 'regular', 'basic'],
        ['tail <group-name> --since 1h', 'Tail recent logs.', 'regular', 'intermediate'],
        ['filter-log-events --log-group-name <group> --filter-pattern ERROR', 'Filter logs by pattern.', 'regular', 'advanced'],
      ],
    },
    {
      base: 'aws ecr',
      tag: 'ecr',
      actions: [
        ['describe-repositories', 'List ECR repositories.', 'regular', 'basic'],
        ['get-login-password', 'Get docker login password.', 'regular', 'intermediate'],
        ['list-images --repository-name <repo>', 'List repository images.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws sqs',
      tag: 'sqs',
      actions: [
        ['list-queues', 'List SQS queues.', 'regular', 'basic'],
        ['get-queue-attributes --queue-url <url> --attribute-names All', 'Read queue attributes.', 'regular', 'intermediate'],
        ['purge-queue --queue-url <url>', 'Purge queue messages.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'aws sns',
      tag: 'sns',
      actions: [
        ['list-topics', 'List SNS topics.', 'regular', 'basic'],
        ['publish --topic-arn <arn> --message "hello"', 'Publish message to topic.', 'regular', 'intermediate'],
        ['list-subscriptions-by-topic --topic-arn <arn>', 'List topic subscriptions.', 'regular', 'intermediate'],
      ],
    },
  ];

  awsFamilies.push(
    {
      base: 'aws cloudwatch',
      tag: 'cloudwatch',
      actions: [
        ['list-metrics', 'List available CloudWatch metrics.', 'regular', 'intermediate'],
        ['get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization --start-time <ts> --end-time <ts> --period 300 --statistics Average', 'Fetch metric stats.', 'rare', 'advanced'],
        ['describe-alarms', 'List CloudWatch alarms.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws route53',
      tag: 'dns',
      actions: [
        ['list-hosted-zones', 'List Route53 hosted zones.', 'regular', 'basic'],
        ['list-resource-record-sets --hosted-zone-id <id>', 'List DNS records for zone.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws apigatewayv2',
      tag: 'api-gateway',
      actions: [
        ['get-apis', 'List API Gateway v2 APIs.', 'regular', 'basic'],
        ['get-stages --api-id <id>', 'List API stages.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws kinesis',
      tag: 'kinesis',
      actions: [
        ['list-streams', 'List Kinesis streams.', 'regular', 'basic'],
        ['describe-stream-summary --stream-name <name>', 'Describe stream summary.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws events',
      tag: 'eventbridge',
      actions: [
        ['list-rules', 'List EventBridge rules.', 'regular', 'basic'],
        ['list-targets-by-rule --rule <rule>', 'List targets for EventBridge rule.', 'regular', 'intermediate'],
        ['put-events --entries file://entries.json', 'Publish custom events.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'aws kms',
      tag: 'kms',
      actions: [
        ['list-keys', 'List KMS keys.', 'regular', 'basic'],
        ['describe-key --key-id <key-id>', 'Describe KMS key metadata.', 'regular', 'intermediate'],
        ['encrypt --key-id <key-id> --plaintext fileb://secret.txt --output text --query CiphertextBlob', 'Encrypt payload.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'aws elasticache',
      tag: 'elasticache',
      actions: [
        ['describe-cache-clusters', 'List ElastiCache clusters.', 'regular', 'intermediate'],
        ['describe-cache-subnet-groups', 'List ElastiCache subnet groups.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws autoscaling',
      tag: 'autoscaling',
      actions: [
        ['describe-auto-scaling-groups', 'List Auto Scaling groups.', 'regular', 'intermediate'],
        ['describe-scaling-policies --auto-scaling-group-name <name>', 'List scaling policies.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'aws elbv2',
      tag: 'load-balancer',
      actions: [
        ['describe-load-balancers', 'List application/network load balancers.', 'regular', 'intermediate'],
        ['describe-target-groups', 'List target groups.', 'regular', 'intermediate'],
        ['describe-target-health --target-group-arn <arn>', 'Show target health state.', 'regular', 'intermediate'],
      ],
    },
  );

  awsFamilies.forEach((family) => {
    family.actions.forEach((action) => {
      addAws(`${family.base} ${action[0]}`, action[1], action[2], action[3], [family.tag]);
    });
  });

  const azureCore = [];
  function addAzure(shortcut, description, usage, level, tags, flags) {
    azureCore.push({ shortcut, description, usage, level, tags, flags: flags || [] });
  }

  [
    ['az login', 'Sign into Azure.', 'common', 'basic', ['auth']],
    ['az account show', 'Show active account.', 'common', 'basic', ['account']],
    ['az account list -o table', 'List available accounts.', 'regular', 'basic', ['account']],
    ['az group list -o table', 'List resource groups.', 'common', 'basic', ['resource-group']],
    ['az group create -n <rg> -l westeurope', 'Create resource group.', 'regular', 'basic', ['resource-group']],
    ['az group delete -n <rg> -y', 'Delete resource group.', 'rare', 'intermediate', ['resource-group']],
  ].forEach((row) => addAzure(...row));

  const azureFamilies = [
    {
      base: 'az vm',
      tag: 'vm',
      actions: [
        ['list -o table', 'List virtual machines.', 'common', 'basic'],
        ['show -g <rg> -n <vm>', 'Show VM details.', 'regular', 'intermediate'],
        ['start -g <rg> -n <vm>', 'Start VM.', 'regular', 'basic'],
        ['stop -g <rg> -n <vm>', 'Stop VM.', 'regular', 'basic'],
        ['deallocate -g <rg> -n <vm>', 'Deallocate VM compute resources.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az aks',
      tag: 'aks',
      actions: [
        ['list -o table', 'List AKS clusters.', 'regular', 'basic'],
        ['show -g <rg> -n <cluster>', 'Show AKS cluster details.', 'regular', 'intermediate'],
        ['get-credentials -g <rg> -n <cluster>', 'Pull kubectl credentials.', 'common', 'basic'],
        ['upgrade -g <rg> -n <cluster> --kubernetes-version <version>', 'Upgrade cluster version.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'az acr',
      tag: 'acr',
      actions: [
        ['list -o table', 'List Azure container registries.', 'regular', 'basic'],
        ['show -n <registry>', 'Show registry details.', 'regular', 'intermediate'],
        ['login -n <registry>', 'Login docker to registry.', 'regular', 'intermediate'],
        ['repository list -n <registry> -o table', 'List repositories in registry.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az webapp',
      tag: 'webapp',
      actions: [
        ['list -o table', 'List App Service apps.', 'regular', 'basic'],
        ['show -g <rg> -n <app>', 'Show app settings.', 'regular', 'intermediate'],
        ['restart -g <rg> -n <app>', 'Restart web app.', 'regular', 'intermediate'],
        ['log tail -g <rg> -n <app>', 'Tail web app logs.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az functionapp',
      tag: 'functions',
      actions: [
        ['list -o table', 'List Function Apps.', 'regular', 'basic'],
        ['show -g <rg> -n <app>', 'Show function app.', 'regular', 'intermediate'],
        ['restart -g <rg> -n <app>', 'Restart function app.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az storage account',
      tag: 'storage',
      actions: [
        ['list -o table', 'List storage accounts.', 'regular', 'basic'],
        ['show -g <rg> -n <account>', 'Show storage account details.', 'regular', 'intermediate'],
        ['keys list -g <rg> -n <account>', 'List storage account keys.', 'rare', 'advanced'],
      ],
    },
    {
      base: 'az sql server',
      tag: 'sql',
      actions: [
        ['list -o table', 'List SQL servers.', 'regular', 'basic'],
        ['show -g <rg> -n <server>', 'Show SQL server details.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az sql db',
      tag: 'sql',
      actions: [
        ['list -g <rg> -s <server> -o table', 'List SQL databases.', 'regular', 'basic'],
        ['show -g <rg> -s <server> -n <db>', 'Show SQL database details.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az monitor',
      tag: 'monitoring',
      actions: [
        ['activity-log list --max-events 20', 'List recent activity log events.', 'regular', 'intermediate'],
        ['metrics list --resource <id> --metric Percentage CPU', 'Query resource metrics.', 'rare', 'advanced'],
      ],
    },
  ];

  azureFamilies.push(
    {
      base: 'az keyvault',
      tag: 'keyvault',
      actions: [
        ['list -o table', 'List Key Vault resources.', 'regular', 'basic'],
        ['show -n <vault>', 'Show Key Vault properties.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az keyvault secret',
      tag: 'keyvault',
      actions: [
        ['list --vault-name <vault> -o table', 'List secrets in key vault.', 'regular', 'intermediate'],
        ['show --vault-name <vault> -n <secret>', 'Show secret metadata/value.', 'regular', 'intermediate'],
        ['set --vault-name <vault> -n <secret> --value <value>', 'Set secret value.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az network vnet',
      tag: 'network',
      actions: [
        ['list -o table', 'List virtual networks.', 'regular', 'basic'],
        ['show -g <rg> -n <vnet>', 'Show VNet configuration.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az network nsg',
      tag: 'network',
      actions: [
        ['list -o table', 'List network security groups.', 'regular', 'basic'],
        ['show -g <rg> -n <nsg>', 'Show NSG rules.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az network public-ip',
      tag: 'network',
      actions: [
        ['list -o table', 'List public IP resources.', 'regular', 'basic'],
        ['show -g <rg> -n <ip>', 'Show public IP details.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az monitor log-analytics workspace',
      tag: 'monitoring',
      actions: [
        ['list -o table', 'List Log Analytics workspaces.', 'regular', 'intermediate'],
        ['show -g <rg> -n <workspace>', 'Show workspace details.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az containerapp',
      tag: 'container-apps',
      actions: [
        ['list -o table', 'List Azure Container Apps.', 'regular', 'basic'],
        ['show -g <rg> -n <app>', 'Show container app details.', 'regular', 'intermediate'],
        ['revision list -g <rg> -n <app> -o table', 'List container app revisions.', 'regular', 'intermediate'],
      ],
    },
    {
      base: 'az role assignment',
      tag: 'iam',
      actions: [
        ['list --assignee <id> -o table', 'List RBAC role assignments.', 'regular', 'intermediate'],
        ['create --assignee <id> --role Reader --scope <scope>', 'Create role assignment.', 'rare', 'advanced'],
      ],
    },
  );

  azureFamilies.forEach((family) => {
    family.actions.forEach((action) => {
      addAzure(`${family.base} ${action[0]}`, action[1], action[2], action[3], [family.tag]);
    });
  });

  const all = [
    ...expandEntries({
      group: 'Vim',
      program: 'Vim Editor',
      categories: ['Linux', 'Editors'],
      docs: 'https://vimhelp.org/',
      entries: [...vimEntries, ...vimExtendedEntries],
      sharedFlags: [],
      expandFlags: false,
      allowFlagCombo: false,
    }),
    ...expandEntries({
      group: 'Tmux',
      program: 'Tmux Multiplexer',
      categories: ['Linux', 'Terminal / Multiplexer'],
      docs: 'https://github.com/tmux/tmux/wiki',
      entries: tmuxEntries,
      sharedFlags: [],
      expandFlags: false,
      allowFlagCombo: false,
    }),
    ...expandEntries({
      group: 'VS Code',
      program: 'Visual Studio Code',
      categories: ['Editors'],
      docs: 'https://code.visualstudio.com/docs/getstarted/keybindings',
      entries: [...vscodeEntries, ...vscodeExtendedEntries],
      sharedFlags: [],
      expandFlags: false,
      allowFlagCombo: false,
    }),
    ...expandEntries({
      group: 'Neovim',
      program: 'Neovim',
      categories: ['Editors', 'Linux'],
      docs: 'https://neovim.io/doc/',
      entries: neovimEntries,
      sharedFlags: [],
      expandFlags: false,
      allowFlagCombo: false,
    }),
    ...expandEntries({
      group: 'Windows',
      program: 'Windows OS',
      categories: ['Windows'],
      docs: 'https://support.microsoft.com/windows',
      entries: windowsEntries,
      sharedFlags: [],
      expandFlags: false,
      allowFlagCombo: false,
    }),
    ...expandEntries({
      group: 'macOS',
      program: 'macOS',
      categories: ['macOS'],
      docs: 'https://support.apple.com/en-gb/guide/mac-help/welcome/mac',
      entries: macEntries,
      sharedFlags: [],
      expandFlags: false,
      allowFlagCombo: false,
    }),
    ...expandEntries({
      group: 'Git',
      program: 'Git CLI',
      categories: ['Linux', 'Editors', 'Terminal / Multiplexer'],
      docs: 'https://git-scm.com/docs',
      entries: [...gitEntries, ...gitExtendedEntries],
      sharedFlags: SHARED.git,
      expandFlags: false,
      allowFlagCombo: true,
    }),
    ...expandEntries({
      group: 'General Bash',
      program: 'Bash / Zsh / Warp',
      categories: ['Linux', 'Terminal / Multiplexer'],
      docs: 'https://www.gnu.org/software/bash/manual/bash.html',
      entries: [...shellEntries, ...shellExtendedEntries],
      sharedFlags: (item) => (item.expandFlags ? SHARED.linux : []),
      expandFlags: false,
      allowFlagCombo: false,
    }),
    ...expandEntries({
      group: 'Linux Commands',
      program: 'Linux Core Utils',
      categories: ['Linux', 'Terminal / Multiplexer'],
      docs: 'https://man7.org/linux/man-pages/index.html',
      entries: [...linuxEntries, ...linuxExtendedEntries],
      sharedFlags: SHARED.linux,
      expandFlags: false,
      allowFlagCombo: true,
    }),
    ...expandEntries({
      group: 'GCloud CLI',
      program: 'Google Cloud CLI',
      categories: ['Cloud'],
      docs: 'https://cloud.google.com/sdk/docs',
      entries: gcloudCore,
      sharedFlags: SHARED.gcloud,
      expandFlags: false,
      allowFlagCombo: true,
    }),
    ...expandEntries({
      group: 'AWS CLI',
      program: 'Amazon AWS CLI',
      categories: ['Cloud'],
      docs: 'https://docs.aws.amazon.com/cli/latest/reference/',
      entries: awsCore,
      sharedFlags: SHARED.aws,
      expandFlags: false,
      allowFlagCombo: true,
    }),
    ...expandEntries({
      group: 'Azure CLI',
      program: 'Microsoft Azure CLI',
      categories: ['Cloud'],
      docs: 'https://learn.microsoft.com/en-us/cli/azure/',
      entries: azureCore,
      sharedFlags: SHARED.azure,
      expandFlags: false,
      allowFlagCombo: true,
    }),
  ];

  function inferEntryType(entry) {
    const shortcut = String(entry.shortcut || '');
    const group = String(entry.group || '').toLowerCase();
    if (group === 'tmux') return shortcut.startsWith('tmux ') ? 'command' : 'shortcut';
    if (['vim', 'vs code', 'neovim', 'windows', 'macos'].includes(group)) return 'shortcut';
    if (/^(ctrl|cmd|alt|win|shift|f\d+|esc|tab)/i.test(shortcut)) return 'shortcut';
    if (/\+/.test(shortcut) && !shortcut.includes(' ')) return 'shortcut';
    return 'command';
  }

  function uniqBy(items, keyFn) {
    const map = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }

  function sampleArgValue(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('project')) return 'my-project';
    if (n.includes('region')) return 'us-central1';
    if (n.includes('zone')) return 'us-central1-a';
    if (n.includes('instance')) return 'my-instance';
    if (n.includes('cluster')) return 'my-cluster';
    if (n.includes('service')) return 'my-service';
    if (n.includes('bucket')) return 'my-bucket';
    if (n.includes('account')) return 'my-account';
    if (n.includes('profile')) return 'default';
    if (n.includes('branch')) return 'feature/refactor';
    if (n.includes('file')) return 'path/to/file.txt';
    if (n.includes('path')) return '/path/to/resource';
    if (n.includes('name')) return 'my-name';
    if (n.includes('id')) return '12345';
    if (n.includes('rg')) return 'rg-main';
    if (n.includes('vm')) return 'vm-main';
    return 'value';
  }

  function placeholderFlags(shortcut) {
    const flags = [];
    const seen = new Set();
    for (const match of String(shortcut || '').matchAll(/<([^>]+)>/g)) {
      const raw = match[1].trim();
      const token = `<${raw}>`;
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      flags.push(flag(token, `Argument value for ${raw}.`, sampleArgValue(raw), 'intermediate', 'regular'));
    }
    return flags;
  }

  function commandStem(shortcut) {
    const tokens = String(shortcut || '').trim().split(/\s+/).filter(Boolean);
    const stem = [];
    for (const token of tokens) {
      if (token.startsWith('<') || token.startsWith('-')) break;
      stem.push(token);
    }
    return stem.join(' ') || String(shortcut || '').trim();
  }

  function levelRank(level) {
    const order = ['basic', 'intermediate', 'advanced'];
    const idx = order.indexOf(String(level || '').toLowerCase());
    return idx >= 0 ? idx : 1;
  }

  function usageRank(usage) {
    const order = ['common', 'regular', 'rare'];
    const idx = order.indexOf(String(usage || '').toLowerCase());
    return idx >= 0 ? idx : 1;
  }

  function normalizeAndUnify(entries) {
    const prepared = entries.map((entry) => {
      const type = entry.type || inferEntryType(entry);
      const baseShortcut = entry.baseShortcut || (type === 'command' ? commandStem(entry.shortcut) : entry.shortcut);
      const suffix = String(entry.shortcut || '').startsWith(baseShortcut)
        ? String(entry.shortcut || '').slice(baseShortcut.length).trim()
        : '';
      const autoFlags = type === 'command' ? placeholderFlags(entry.shortcut) : [];
      const mergedFlags = uniqFlags([...(entry.flags || []), ...autoFlags]);
      const examples = [...(entry.examples || [])];
      if (type === 'command' && !examples.length) {
        const code = String(entry.shortcut || '').replace(/<([^>]+)>/g, (_, raw) => sampleArgValue(raw));
        examples.push({ label: 'Example', code });
      }
      const argNotes = placeholderFlags(entry.shortcut).map((f) => `${f.name}: ${f.description}`);

      return {
        ...entry,
        type,
        level: String(entry.level || 'intermediate').toLowerCase(),
        usage: String(entry.usage || 'regular').toLowerCase(),
        baseShortcut,
        flagSuffix: suffix,
        flags: mergedFlags,
        examples: uniqBy(examples, (example) => String(example.code || '').trim().toLowerCase()),
        detail: {
          ...(entry.detail || {}),
          notes: uniqBy([...(entry.detail?.notes || []), ...argNotes], (note) => String(note || '').toLowerCase()),
        },
      };
    });

    const passthrough = [];
    const groupedCommands = new Map();

    prepared.forEach((entry) => {
      if (entry.type !== 'command') {
        passthrough.push(entry);
        return;
      }
      const stem = commandStem(entry.shortcut);
      const key = `${entry.group}|${stem.toLowerCase()}`;
      if (!groupedCommands.has(key)) {
        groupedCommands.set(key, { ...entry, baseShortcut: stem, flagSuffix: String(entry.shortcut || '').slice(stem.length).trim() });
        return;
      }

      const current = groupedCommands.get(key);
      current.tags = uniqBy([...(current.tags || []), ...(entry.tags || [])], (tag) => String(tag).toLowerCase());
      current.flags = uniqFlags([...(current.flags || []), ...(entry.flags || [])]);
      current.examples = uniqBy([...(current.examples || []), ...(entry.examples || []), { label: 'Variant', code: entry.shortcut }], (example) => String(example.code || '').trim().toLowerCase());
      current.level = levelRank(entry.level) > levelRank(current.level) ? entry.level : current.level;
      current.usage = usageRank(entry.usage) < usageRank(current.usage) ? entry.usage : current.usage;
      if (entry.description && entry.description !== current.description) {
        const note = `Variant: ${entry.description}`;
        current.detail = current.detail || {};
        current.detail.notes = uniqBy([...(current.detail.notes || []), note], (n) => String(n).toLowerCase());
      }
    });

    return uniqBy([...passthrough, ...groupedCommands.values()], (entry) => `${entry.group}|${entry.type}|${String(entry.shortcut || "").toLowerCase()}`);
  }

  const normalizedAll = normalizeAndUnify(all);

  // Mark a featured subset for the home section.
  normalizedAll.slice(0, 80).forEach((entry, idx) => {
    if (idx % 7 === 0) entry.featured = true;
  });

  window.ShortcutVaultData = {

    CATEGORIES,
    BASE_SHORTCUTS: normalizedAll,
    META: {
      count: normalizedAll.length,
      generatedAt: new Date().toISOString(),
    },
  };
})();
