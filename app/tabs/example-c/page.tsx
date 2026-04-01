/**
 * @route /tabs/example-c
 * @pattern Static Route + Cross-Tab Communication
 * @description
 * 상품 목록 탭에서 장바구니 탭으로 아이템을 추가하는 실용적 패턴.
 * 부모 컴포넌트가 공유 상태(cartItems)를 소유하고,
 * 각 탭의 children에 props로 전달하여 탭 간 데이터 통신을 구현한다.
 * 탭 전환 시 장바구니 상태가 리셋되지 않는다.
 */
'use client'

import { useState, useCallback } from 'react'
import { Tab, TabSub, Panel, Badge, Button } from '@/components/control'
import RouteInfo from '@/components/shared/RouteInfo'

interface Product {
  id: number
  name: string
  price: number
  category: string
}

interface CartItem extends Product {
  quantity: number
}

const PRODUCTS: Product[] = [
  { id: 1, name: '무선 키보드', price: 59000, category: '주변기기' },
  { id: 2, name: '게이밍 마우스', price: 45000, category: '주변기기' },
  { id: 3, name: 'USB-C 허브', price: 32000, category: '액세서리' },
  { id: 4, name: '모니터 암', price: 78000, category: '가구' },
  { id: 5, name: '마우스패드 XL', price: 25000, category: '액세서리' },
  { id: 6, name: '웹캠 HD', price: 89000, category: '주변기기' },
]

const CATEGORIES = ['전체', ...Array.from(new Set(PRODUCTS.map((p) => p.category)))]

export default function ExampleCPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('전체')

  const addToCart = useCallback((product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }, [])

  const updateQuantity = useCallback((id: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const filteredProducts =
    selectedCategory === '전체'
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === selectedCategory)

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Example C — 크로스탭 통신</h1>
        <p className="mt-2 text-text-secondary">
          상품 목록에서 장바구니로 아이템을 추가합니다. 부모 상태를 통해 탭 간 데이터를 공유합니다.
        </p>
      </div>

      <Panel variant="outlined">
        <Tab>
          {/* 상품 목록 탭 */}
          <TabSub label={`상품 목록 (${PRODUCTS.length})`}>
            <div className="space-y-4">
              {/* 카테고리 필터 */}
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-accent text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* 상품 그리드 */}
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredProducts.map((product) => {
                  const inCart = cartItems.find((item) => item.id === product.id)
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">{product.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm text-text-secondary">
                            {product.price.toLocaleString()}원
                          </span>
                          <Badge variant="info">{product.category}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {inCart && (
                          <span className="text-xs text-accent font-medium">
                            {inCart.quantity}개
                          </span>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => addToCart(product)}
                        >
                          추가
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabSub>

          {/* 장바구니 탭 */}
          <TabSub label={`장바구니 (${totalCount})`}>
            <div className="space-y-4">
              {cartItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  장바구니가 비어 있습니다. 상품 목록 탭에서 상품을 추가해보세요.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">{item.name}</p>
                          <span className="text-xs text-text-muted">
                            {item.price.toLocaleString()}원 x {item.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {(item.price * item.quantity).toLocaleString()}원
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary hover:bg-bg-tertiary transition-colors"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-sm text-text-primary">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary hover:bg-bg-tertiary transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 합계 */}
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div>
                      <span className="text-sm text-text-secondary">합계</span>
                      <p className="text-lg font-bold text-text-primary">
                        {totalAmount.toLocaleString()}원
                      </p>
                    </div>
                    <Button variant="danger" size="sm" onClick={clearCart}>
                      전체 삭제
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabSub>

          {/* 주문 요약 탭 */}
          <TabSub label="주문 요약">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-text-secondary">카테고리별 요약</h3>
              {cartItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">
                  장바구니에 상품을 추가하면 카테고리별 요약이 표시됩니다.
                </p>
              ) : (
                <>
                  {Array.from(new Set(cartItems.map((i) => i.category))).map((cat) => {
                    const items = cartItems.filter((i) => i.category === cat)
                    const catTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
                    return (
                      <div
                        key={cat}
                        className="rounded-lg border border-border bg-bg-secondary p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="info">{cat}</Badge>
                          <span className="text-sm font-semibold text-text-primary">
                            {catTotal.toLocaleString()}원
                          </span>
                        </div>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <p key={item.id} className="text-xs text-text-muted">
                              {item.name} x {item.quantity}
                            </p>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  <div className="border-t border-border pt-3 text-right">
                    <span className="text-sm text-text-secondary">총 결제 금액: </span>
                    <span className="text-lg font-bold text-accent">
                      {totalAmount.toLocaleString()}원
                    </span>
                  </div>
                </>
              )}
            </div>
          </TabSub>
        </Tab>
      </Panel>

      <RouteInfo
        pattern="Cross-Tab Communication"
        syntax="app/tabs/example-c/page.tsx"
        description="부모 컴포넌트가 공유 상태를 소유하고 각 탭의 children에 전달하여 탭 간 데이터 통신을 구현한다. 상품 추가/수량 변경이 모든 탭에 즉시 반영된다."
      />
    </div>
  )
}
