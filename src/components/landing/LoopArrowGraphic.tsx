import Image from 'next/image';

export function LoopArrowGraphic() {
  return (
    <div aria-hidden="true">
      <Image
        src="/docs/assets/loop.PNG"
        alt=""
        width={420}
        height={540}
        sizes="(max-width: 768px) 80vw, 420px"
        priority={false}
      />
    </div>
  );
}
