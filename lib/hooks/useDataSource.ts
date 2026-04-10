import { useState, useEffect } from 'react';

// 1. 제네릭을 활용한 다형성 타입 정의
export type DataSourceProp<T> =
    | T[]
    | Promise<T[]>
    | ((params?: any) => Promise<T[]>);

export function useDataSource<T>(dataSource: DataSourceProp<T>, params?: any) {
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true; // Race condition 방지용

        const resolveData = async () => {
            // 케이스 1: 이미 배열인 경우 (동기 데이터)
            if (Array.isArray(dataSource)) {
                setData(dataSource);
                setIsLoading(false);
                return;
            }

            // 비동기 처리 시작
            setIsLoading(true);
            setError(null);

            try {
                let resolvedData: T[] = [];

                // 케이스 2: Promise를 반환하는 함수인 경우 (파라미터 포함)
                if (typeof dataSource === 'function') {
                    resolvedData = await dataSource(params);
                }
                // 케이스 3: Promise 객체인 경우
                else if (dataSource instanceof Promise) {
                    resolvedData = await dataSource;
                }

                if (isMounted) setData(resolvedData);
            } catch (err) {
                if (isMounted) setError(err instanceof Error ? err : new Error('데이터 로딩 실패'));
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        resolveData();

        // Cleanup 함수: 컴포넌트 언마운트 시 상태 업데이트 방지
        return () => { isMounted = false; };
    }, [dataSource, params]); // dataSource나 파라미터가 변경되면 재실행

    return { data, isLoading, error };
}