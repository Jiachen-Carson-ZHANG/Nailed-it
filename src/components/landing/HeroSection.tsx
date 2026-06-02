import Image from 'next/image';
import Link from 'next/link';

import heroImage from '../../../docs/assets/hero_icon.PNG?url';
import logoImage from '../../../docs/assets/logo.PNG?url';
import { landingRoutes } from './landing-content';

export function HeroSection() {
  return (
    <section aria-label="Hero">
      <Image src={logoImage} alt="" width={240} height={84} priority unoptimized />
      <div>
        <h1>少沟通，多成交</h1>
        <p>
          让美甲预约更智能： 基于AI拆解美甲款式图片， 集合报价、 预约、
          款式库的智能全链运营系统
        </p>
        <div>
          <Link href={landingRoutes.customer}>用户入口</Link>
          <Link href={landingRoutes.merchant}>商家入口</Link>
        </div>
      </div>
      <Image src={heroImage} alt="" width={640} height={640} priority unoptimized />
    </section>
  );
}
