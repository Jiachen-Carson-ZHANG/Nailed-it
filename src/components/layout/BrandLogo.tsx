import Image from 'next/image';

import logoImage from '@/landing_assets/logo.PNG?url';

type BrandLogoVariant = 'hero-mark' | 'topbar';

type BrandLogoProps = {
  alt?: string;
  className?: string;
  variant?: BrandLogoVariant;
};

const brandLogoSizeByVariant: Record<BrandLogoVariant, { height: number; width: number }> = {
  // 中文注释：顶部栏优先控制高度，避免横向 logo 把右侧操作区挤出视口。
  topbar: { width: 1340, height: 658 },
  // 中文注释：隐私页头部需要更醒目，仍保持原图比例，由 CSS 控制最终显示尺寸。
  'hero-mark': { width: 1340, height: 658 }
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export function BrandLogo({
  alt = 'Nailed-it',
  className,
  variant = 'topbar'
}: BrandLogoProps) {
  const imageSize = brandLogoSizeByVariant[variant];

  return (
    <Image
      alt={alt}
      className={joinClassNames('brand-logo', `brand-logo-${variant}`, className)}
      height={imageSize.height}
      src={logoImage}
      unoptimized
      width={imageSize.width}
    />
  );
}
