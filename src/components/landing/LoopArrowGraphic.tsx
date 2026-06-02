import Image from 'next/image';

import loopImage from '../../../docs/assets/loop.PNG?url';

export function LoopArrowGraphic() {
  return (
    <div aria-hidden="true">
      <Image
        src={loopImage}
        alt=""
        width={420}
        height={540}
        sizes="(max-width: 768px) 80vw, 420px"
        priority={false}
      />
    </div>
  );
}
