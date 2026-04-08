# Next.js 16
	- React 17 (SPA)
	- JS Bundle
	- Full Stack


# Client Boundary
	- RSC / RCC
	- 'use server' / 'use client'

	
# App Route
	- layout.tsx
	- template.tsx
	- page.tsx
	- loading.tsx
	- error.tsx
	- global-error.tsx
	- not-found.tsx
	- default.tsx
	- route.ts
	
	- folder / 
	- (folder) / 
	- [folder] /
	- [...folder] / 
	- [[...folder]] / 
	- @folder / 
	- (.)folder
	- _folder / 
	
	- params /asdf/
	- searchParams /asdf?id=123

	
# API Route
	- app/api/route.ts


# Server Actions
	- type key = SELECT COLUMN

# Error / Loading
	- page.tsx 랜더링 중 발생한 에러 --> error.tsx (React Error Boundary)
	- 이벤트 핸들러 내부의 비동기 Promise rejection은 --> X error.tsx 이동하지 않음.
	- useEffect의 비동기 콜백에서 던져진 에러 --> X error.tsx 이동하지 않음. (Error Boundary로 전파되지 않고 처리되지 않은 Promise rejection으로 콘솔에만 찍힌다.)
	- 해결
		- 상태로 저장했다가 랜더링 중 --> if (error) throw error
		- useTransition() + startTransition() 사용
		- useActionState() 사용
		
	- Suspense
	- fallback
	- layout -> Suspense (loading.tsx) -> page.tsx -> child component
	- use()

# tsconfig.json

"compilerOptions": {
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"],
    "@components/*": ["./components/*"]
  }
}

    "paths": {
      "@/*": [
        "./*"
      ],
      "@/app/*": [
        "./app/*"
      ],
      "@/components/*": [
        "./components/*"
      ],
      "@/lib/*": [
        "./lib/*"
      ],
      "@/public/*": [
        "./public/*"
      ],
      "@/styles/*": [
        "./styles/*"
      ]
    }


# proxy.ts
	- Request --> proxy.ts --> Reponse 통과
	
	- 인증 및 인가 처리: 인증 토큰 확인 및 보호된 페이지 접근 제어.
	- 라우팅 및 리다이렉트: 사용자 위치/조건에 따른 페이지 리다이렉트 (예: 국가별, 권한별).
	- API 요청 통합 (BFF): 외부 API 요청을 프록시하여 보안 강화 및 CORS 문제 해결.
	- 요청/응답 수정: 헤더 추가, 쿠키 설정(set) 및 조회(get).
	- 캐싱 및 성능 최적화: 특정 경로에 대한 응답 캐싱 설정.
	
# cache

async function getStockPrice() {
  // 이 fetch는 결과를 캐싱하지 않고 매번 새롭게 서버에 요청합니다.
  const res = await fetch('https://api.example.com/stock', { 
    cache: 'no-store' 
  });
  return res.json();
}


// app/cart/page.tsx
export const dynamic = 'force-dynamic'; // 이 페이지는 절대 캐싱하지 않음

export default async function CartPage() {
  // ...
}


async function getNewsHeadlines() {
  // 이 데이터는 한 번 가져오면 60초 동안 캐싱됩니다.
  // 60초가 지난 후 들어오는 첫 요청 시, 백그라운드에서 데이터를 새로 가져와 캐시를 교체합니다.
  const res = await fetch('https://api.example.com/news', {
    next: { revalidate: 60 } // 60초
  });
  return res.json();
}


// app/news/page.tsx
export const revalidate = 3600; // 이 페이지는 1시간(3600초)마다 캐시 갱신

export default async function NewsPage() {
  // ...
}


const res = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
});


// app/actions.ts
'use server'

import { revalidateTag, revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  // 1. DB에 새 글 저장하는 로직
  await db.post.create(formData);

  // 2-A. 특정 태그가 붙은 캐시 날리기 (추천)
  revalidateTag('posts'); 

  // 2-B. 특정 경로(URL)의 캐시를 통째로 날리기
  // revalidatePath('/board'); 
}


====================================================================================================

- 클라이언트 경계(Client Boundary)

    1. Client Boundary란 무엇인가? (전체적인 개념)
    Client Boundary는 서버에서만 실행되는 코드(Server Components)와 브라우저(클라이언트)로 전송되어 실행되어야 하는 코드(Client Components)를 나누는 명시적인 선입니다.

    Next.js App Router 환경에서는 모든 컴포넌트가 기본적으로 **서버 컴포넌트(RSC)**입니다. 서버 컴포넌트는 서버에서 HTML을 생성하는 데만 사용되며, 브라우저로 JavaScript 코드를 보내지 않습니다. 하지만 사용자와 상호작용(클릭, 입력 등)이 필요하거나 브라우저 API를 써야 하는 순간이 오면 클라이언트의 기능이 필요해집니다.

    이때 파일 최상단에 "use client"라는 지시어(Directive)를 선언하게 되는데, 이 지시어가 선언된 곳이 바로 **Client Boundary(클라이언트 경계)**가 됩니다.

    2. 개발자가 반드시 알아야 할 4가지 핵심 원칙
        ① 경계는 아래로 흐른다 (Cascading)
        "use client"를 선언한 파일에서 import 하는 모든 하위 컴포넌트와 모듈은 자동으로 클라이언트 번들에 포함됩니다. 하위 컴포넌트 파일에 일일이 "use client"를 적을 필요가 없습니다.

        주의점: 무심코 최상위 레이아웃이나 페이지에 "use client"를 선언하면, 하위의 모든 컴포넌트가 클라이언트 컴포넌트가 되어 서버 컴포넌트의 이점(Zero 번들 사이즈, 백엔드 직접 접근 등)을 잃게 됩니다. 경계는 가능한 트리 구조의 **최하단(말단)으로 밀어내는 것(Pushing down)**이 좋습니다.

        ② 클라이언트에서 서버를 직접 Import 할 수 없다
        가장 많이 마주치게 될 에러입니다. 클라이언트 컴포넌트 파일 내부에서는 서버 컴포넌트를 직접 import하여 렌더링할 수 없습니다.
        하지만 children이나 props를 통해 전달받는 것은 가능합니다. (Interleaving 패턴)

        올바른 패턴 예시:
        서버 컴포넌트에서 클라이언트 컴포넌트를 호출하고, 그 사이에 다른 서버 컴포넌트를 children으로 끼워 넣는 방식으로 설계해야 합니다.
        <ClientLayout> <ServerPage /> </ClientLayout>

        ③ 클라이언트 컴포넌트도 서버에서 렌더링(SSR) 된다
        이름이 '클라이언트 컴포넌트'라서 브라우저에서만 그려진다고 오해하기 쉽습니다. 하지만 클라이언트 컴포넌트 역시 초기 로딩 시 서버에서 HTML로 미리 렌더링(Pre-rendering)되어 내려옵니다.
        이후 브라우저에서 JavaScript가 연결되는 과정인 **Hydration(수화)**을 거쳐 상호작용이 가능해집니다. "use client"는 '브라우저에서만 실행하라'는 뜻이 아니라, **'브라우저에서 상호작용하기 위해 JavaScript 번들을 포함하라'**는 뜻입니다.

        ④ Server Actions를 통한 양방향 소통
        React 19에서 강화된 Server Actions("use server")를 사용하면, Client Boundary 내부에 있는 컴포넌트(예: 클라이언트의 <form>이나 버튼)에서 API 라우트 작성 없이 서버의 함수를 직접 호출하여 데이터베이스를 수정하거나 서버 로직을 실행할 수 있습니다.

    3. 언제 Client Boundary를 설정("use client" 사용)해야 할까?

        상태 관리가 필요할 때: useState, useReducer 등을 사용할 때

        생명주기 및 부수 효과가 필요할 때: useEffect, useLayoutEffect 등을 사용할 때

        이벤트 리스너가 필요할 때: onClick, onChange, onSubmit 등 사용자와의 상호작용이 있을 때

        브라우저 전용 API를 사용할 때: window, document, localStorage, geolocation 등

        커스텀 훅(Custom Hooks) 내부에 위의 기능들이 포함되어 있을 때

- 브라우저 작동
    1. 서버의 HTML 생성 및 전송 (초기 화면)

    2. 클라이언트 번들 다운로드

    3. Hydration (수화: 상호작용 연결)

- 클라이언트 번들
    클라이언트 번들에 포함되는 것 (브라우저로 이동 O):
        "use client"가 선언된 컴포넌트의 코드
        해당 클라이언트 컴포넌트가 import 해서 사용하고 있는 외부 라이브러리 (예: 날짜 포맷팅 라이브러리, 차트 라이브러리 등)
        React 자체 구동에 필요한 핵심 런타임 코드
    클라이언트 번들에서 제외되는 것 (브라우저로 이동 X):
        "use client"가 없는 모든 서버 컴포넌트의 코드
        서버 컴포넌트에서만 사용하는 무거운 라이브러리나 DB 접근 코드

- RPC vs REST
	- REST: URL은 자원(명사)만 가리키고, 행위는 HTTP 메서드(GET, POST, PUT, DELETE)로 표현합니다.
	- RPC: 서버에 있는 함수를 클라이언트가 내 컴퓨터에 있는 함수처럼 그냥 이름 불러서 실행하는 방식입니다.

- Server Action
	- 'use server' 지시어를 반드시 사용한다.
		--> 메서드 호출 시 함수를 통째로 클라이언트(브라우저) 번들에 포함
	- 무조건 async 함수여야 한다. 네트워크 통신 간 클라이언트가 기다려야 함.
	- 호출 시에도 await를 사용하거나 Promise 체이닝을 사용해야 한다.

- Client: 
	next/navigation(모든 component) --> useParams() / useSearchParams()
	props(page.tsx / layout.tsx) --> use(params) / use(searchParams) 

- Server: context.params, request.nextUrl.searchParams

- new URLSearchParams(): 
	searchParams를 담고, usePathname() 뒤에 붙여서 새로운 URL을 조합한다.

- use():
	Promise, Context 등의 '리소스' 값을 읽어올 때 사용. 기존의 훅과 달리 if, for문 안에서도 호출 가능. 해당 Promise가 resolve될 때까지 컴포넌트 랜더링을 중단시키고 가장 가까운 Suspense의 fallback UI를 보여줌. 컴포넌트 최상단 외에도 호출 가능하여 불필요한 연산, 랜더링을 줄이는 조건부 로직 작성도 가능함.

- useTransition()
React는 진행 중인 transition이 있으면, 다른 transition의 state 업데이트도 함께 배칭하려고 합니다.
흐름을 보면:
startGridTransition → fetch 시작, isGridPending = true
startChartTransition → fetch 시작, isChartPending = true
~0.5초 후: grid fetch 완료 → setGridData(data) 호출
이 시점에 chart transition이 아직 pending → React가 grid의 커밋을 보류(defer)할 수 있음
~5초 후: chart fetch 완료 → setChartData(data) 호출
두 transition 모두 완료 → 한 번에 커밋
React 19의 useTransition은 concurrent feature로, 진행 중인 transition 렌더가 있으면 중간 결과를 화면에 커밋하지 않고 최종 상태를 한 번에 보여주는 경향이 있습니다.

- Server Component vs Client Component
	- 기본적으로 모두 SC / 파일 최상단에 'use client' 기재해야만 클라이언트
	- 서버에서만 실행 / 서버에서 사전 랜더링 후 브라우저에서 실행
	- useState, useEffect 등 Hook 사용 불가능 / 사용 가능
	- window, document 등 브라우저 API / 사용 가능
	- 브라우저로 코드가 전송되지 않아 아주 가벼움 / 무거워질 수 있음
	- Next.js는 SEO와 초기 로딩 속도를 위해 CC도 일단 서버에서 HTML로 미리 pre-rendering 후, 브라우저에서 JS와 연결되며 hydration (활성화) 되는 것.

- proxy.ts
    1. Rate Limiting (요청 제한)
    IP 또는 사용자 기준으로 단위 시간당 요청 수를 제한합니다. DDoS/brute-force 방어의 첫 번째 방어선입니다.

    // IP별 요청 카운트를 외부 스토어(Redis 등)에서 확인
    const ip = request.headers.get('x-forwarded-for')
    const rateLimit = await checkRateLimit(ip)
    if (rateLimit.exceeded) {
    return new NextResponse('Too Many Requests', { status: 429 })
    }

    2. RBAC (역할 기반 접근 제어)
    단순 인증 여부가 아니라 역할/권한별 경로 제한을 처리합니다. 예: /admin은 ADMIN 역할만 접근.

    const adminPaths = ['/admin', '/emp/manage']
    if (adminPaths.some(p => pathname.startsWith(p)) && token?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/403', request.url))
    }

    3. 지역화 / i18n 라우팅
    Accept-Language 헤더나 쿠키를 기반으로 locale prefix(/ko, /en)를 자동 리다이렉트합니다.

    const locale = request.cookies.get('NEXT_LOCALE')?.value
    || negotiateLocale(request.headers.get('accept-language'))
    if (!pathname.startsWith(`/${locale}`)) {
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url))
    }

    4. Bot / Crawler 감지
    User-Agent를 분석해 SEO 크롤러에게는 별도 처리(예: prerendered 페이지 서빙)를 하거나, 악성 봇을 차단합니다.

    5. A/B 테스트 / Feature Flag
    쿠키 기반으로 사용자를 실험 그룹에 할당하고 다른 경로로 rewrite합니다.

    const bucket = request.cookies.get('ab-bucket')?.value || assignBucket()
    const response = NextResponse.rewrite(new URL(`/experiment/${bucket}${pathname}`, request.url))
    response.cookies.set('ab-bucket', bucket)
    return response

    6. 보안 헤더 주입
    OWASP 권장 보안 헤더를 일괄 적용합니다.

    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=()')
    // CSP는 nonce 기반으로 설정하는 경우가 많음

    7. 로깅 / 트레이싱
    요청 시작 시점에 correlation ID를 생성해 헤더에 심어두면, 이후 서버 컴포넌트·API 라우트에서 추적이 가능합니다.

    const requestId = crypto.randomUUID()
    response.headers.set('x-request-id', requestId)
    
    8. Geo-based 라우팅 / 리다이렉트
    Vercel 등 플랫폼이 제공하는 request.geo 정보를 활용해 국가별 서비스 분기 또는 차단을 수행합니다.

    9. 유지보수 모드
    특정 플래그(환경변수/리모트 설정)가 켜지면 전체 트래픽을 유지보수 페이지로 rewrite합니다.
