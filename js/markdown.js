/**
 * markdown.js - 轻量 Markdown 渲染器
 * 将 Markdown 文本转为 HTML，无外部依赖
 */

function renderMarkdown(text) {
  if (!text) return '';

  // 对 HTML 特殊字符进行转义
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块 (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    return '<pre><code class="language-' + (lang || 'text') + '">' + code.trim() + '</code></pre>';
  });

  // 行内代码 (`...`)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 粗体和斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 引用块
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // 合并连续引用块
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // 分割行进行列表和段落处理
  var lines = html.split('\n');
  var result = [];
  var inUl = false;
  var inOl = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // 跳过已处理的 HTML 块
    if (line.match(/^<(h[1-3]|pre|blockquote)/)) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      result.push(line);
      continue;
    }
    if (line.match(/^<\/(pre|blockquote)/)) {
      result.push(line);
      continue;
    }

    // 无序列表
    var ulMatch = line.match(/^[\-\*] (.+)$/);
    if (ulMatch) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) { result.push('<ul>'); inUl = true; }
      result.push('<li>' + ulMatch[1] + '</li>');
      continue;
    }

    // 有序列表
    var olMatch = line.match(/^\d+\. (.+)$/);
    if (olMatch) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) { result.push('<ol>'); inOl = true; }
      result.push('<li>' + olMatch[1] + '</li>');
      continue;
    }

    // 关闭列表
    if (inUl) { result.push('</ul>'); inUl = false; }
    if (inOl) { result.push('</ol>'); inOl = false; }

    // 分隔线
    if (line.match(/^---+$/)) {
      result.push('<hr>');
      continue;
    }

    // 空行
    if (line.trim() === '') {
      result.push('');
      continue;
    }

    // 普通段落
    result.push('<p>' + line + '</p>');
  }

  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');

  // 合并连续的 <p> 标签之间的空行
  html = result.join('\n');

  // 清理多余空行
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
}
