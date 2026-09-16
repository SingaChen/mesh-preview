function asEntry(file, path) {
  return { file, path, name: file.name };
}

export function hasDirectoryPicker() {
  return typeof window.showDirectoryPicker === "function";
}

async function walkDirectory(handle, prefix, out) {
  for await (const [name, entry] of handle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === "file") {
      out.push(asEntry(await entry.getFile(), path));
    } else if (entry.kind === "directory") {
      await walkDirectory(entry, path, out);
    }
  }
}

export async function pickDirectoryEntries() {
  if (!hasDirectoryPicker()) return null;
  const root = await window.showDirectoryPicker();
  const entries = [];
  await walkDirectory(root, root.name || "", entries);
  return entries;
}

export function entriesFromFileList(fileList) {
  return Array.from(fileList || []).map((file) => {
    const rel = file.webkitRelativePath || file.name;
    return asEntry(file, rel);
  });
}

export function clickInput(input) {
  input.value = "";
  input.click();
}

export function waitForInput(input) {
  return new Promise((resolve) => {
    const onChange = () => {
      input.removeEventListener("change", onChange);
      resolve(entriesFromFileList(input.files));
    };
    input.addEventListener("change", onChange, { once: true });
  });
}
