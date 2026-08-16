export default function renderDescription(description) {
  if (!description) return '';

  return description
    .replace(
      /\[red-font\]\(([^)]+)\)/g,
      '<span class="red-font">$1</span>',
    )
    .replace(
      /\[icon\]\(([^)]+)\)/g,
      '<img src="$1" alt="">',
    ); 
}