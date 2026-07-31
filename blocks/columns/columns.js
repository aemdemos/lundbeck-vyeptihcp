import { getBlockId } from '../../scripts/scripts.js';
import { decorateCellClass, buildPictureContentFromImageCell } from '../../scripts/utils.js';

export default function decorate(block) {
  decorateCellClass(block);

  const blockId = getBlockId('columns');
  block.setAttribute('id', blockId);
  block.setAttribute('aria-label', `columns-${blockId}`);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Columns');

  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      if (!col.querySelector('picture')) return;
      const pictureCells = [...col.children].filter(
        (child) => child.matches('picture') || child.querySelector('picture'),
      );

      if (pictureCells.length >= 2 && pictureCells.length <= 5) {
        // 2-5 picture variants (bare <picture> or p:has(picture)) for art-direction per
        // breakpoint; merge only those cells so any other content (e.g. a caption) stays put
        const placeholder = document.createComment('');
        pictureCells[0].before(placeholder);
        const temp = document.createElement('div');
        temp.append(...pictureCells);
        placeholder.replaceWith(buildPictureContentFromImageCell(temp));
      }
      if (col.children.length === 1) {
        // picture (single or merged art-direction) is the only content in column
        col.classList.add('columns-img-col');
      }
    });
  });
}
