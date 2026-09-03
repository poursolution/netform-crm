# crm.netform.co.kr — 주소 하나, 화면 둘

CRM 을 두 개 만드는 것이 아니다. **화면만 둘이고 데이터는 하나**다.

```
                https://crm.netform.co.kr
                           │
                    접속 환경 확인
                           │
              ┌────────────┴────────────┐
             PC                       모바일
              │                         │
       넷폼CRM_v4_1              담당자앱_모바일
              │                         │
              └────────────┬────────────┘
                        crm-api  (읽기)
                        crm-write (쓰기)
                           │
                        Supabase
```

## 두 가지 방식

| 방식 | 파일 | 주소 유지 | 서버 필요 | 비고 |
|---|---|---|---|---|
| ① 정적 호스팅 (지금 바로) | `index.html` | ✅ | ❌ | 전체화면 iframe. 어떤 정적 호스팅에도 그냥 올리면 된다 |
| ② 서버 내부 Rewrite (권장) | 아래 설정 | ✅ | ✅ | iframe 없이 실제 파일을 그대로 내려준다 |

②를 쓰면 `index.html` 은 필요 없다. ①은 서버 설정 권한이 없을 때의 임시 방편이다.
둘 다 **리다이렉트가 아니다** — 주소창은 계속 `crm.netform.co.kr` 이다.

## 올릴 파일

```
/넷폼CRM_v4_1_Core정리.html      ← PC 관리 CRM
/담당자앱_모바일.html            ← 담당자 모바일 앱  (파일명 그대로. PC 가 이 이름으로 iframe 호출한다)
/index.html                      ← ①번 방식일 때만
```

> 파일명에 `(4)` 같은 꼬리표가 붙어 있으면 **반드시 떼고** 올린다.
> PC CRM 의 담당자 앱 메뉴가 `담당자앱_모바일.html` 을 정확히 이 이름으로 부른다.

## ② 서버 내부 Rewrite 설정

### Nginx
```nginx
map $http_user_agent $nf_view {
    default                                    "/넷폼CRM_v4_1_Core정리.html";
    "~*(Android|iPhone|iPod|Windows Phone)"    "/담당자앱_모바일.html";
}

server {
    server_name crm.netform.co.kr;
    root /var/www/crm;

    # 사용자가 직접 고른 화면이 있으면 그것이 최우선 (index.html 이 심는 쿠키)
    location = / {
        if ($cookie_nf_view = "pc")     { rewrite ^ /넷폼CRM_v4_1_Core정리.html last; }
        if ($cookie_nf_view = "mobile") { rewrite ^ /담당자앱_모바일.html last; }
        rewrite ^ $nf_view last;          # 내부 rewrite — 주소창은 그대로
    }

    location / { try_files $uri $uri/ =404; }
}
```

### Vercel (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/",
      "has": [{ "type": "header", "key": "user-agent", "value": "(?i).*(android|iphone|ipod|windows phone).*" }],
      "destination": "/담당자앱_모바일.html" },
    { "source": "/", "destination": "/넷폼CRM_v4_1_Core정리.html" }
  ]
}
```

### Cloudflare Worker
```js
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/') return env.ASSETS.fetch(req);
    const ua = req.headers.get('user-agent') || '';
    const cookie = /nf_view=(pc|mobile)/.exec(req.headers.get('cookie') || '')?.[1];
    const mobile = cookie ? cookie === 'mobile'
                          : /Android|iPhone|iPod|Windows Phone/i.test(ua);
    url.pathname = mobile ? '/담당자앱_모바일.html' : '/넷폼CRM_v4_1_Core정리.html';
    return env.ASSETS.fetch(new Request(url, req));   // 내부 rewrite
  }
};
```

## 로그인 · 권한

기기는 **어떤 UI 를 보여줄지** 만 정한다. **무엇을 보여줄지** 는 로그인 권한이 정한다.

```
① 기기 판단   PC → PC UI          모바일 → Mobile UI
② 로그인
③ 권한 판단   rep   → 내 영업
              admin → 관리
              dual  → 내 영업 ⇄ 관리 전환
```

## 남은 것

- **Auth/JWT + RLS** — 지금은 웹훅 키 하나로 열려 있다. 서버 인증으로 바꿔야 진짜 배포 가능.
- **웹훅 키 회전** — `2c2a99764d20675093ad320ed6eee4a4` 가 HTML 두 개와 n8n 두 워크플로에 들어 있다. 바꿀 때 네 곳을 함께 바꾼다.
- **실시간 동기화** — 현재는 60초 주기 재조회 + 화면 복귀 시 즉시 재조회다.
  두 화면을 동시에 켜 두고 «즉시» 반영하려면 Supabase Realtime 을 붙여야 한다.
