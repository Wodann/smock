import { Observable, Subject } from 'rxjs';
import { filter, share } from 'rxjs/operators';
import { EVMResult, Message, SmockVMManager, VM } from './types';

export class ObservableVM {
  private vm: VM;
  private beforeMessage$: Observable<Message>;
  private afterMessage$: Observable<EVMResult>;

  constructor(vm: VM) {
    if (!vm) throw new Error('VM is not defined');

    this.vm = vm;
    this.beforeMessage$ = ObservableVM.fromEvent<Message>(vm, 'beforeMessage');
    this.afterMessage$ = ObservableVM.fromEvent<EVMResult>(vm, 'afterMessage');
  }

  getManager(): SmockVMManager {
    return this.vm.stateManager;
  }

  getBeforeMessages(): Observable<Message> {
    return this.beforeMessage$.pipe(filter((message) => !!message.to));
  }

  getAfterMessages(): Observable<EVMResult> {
    return this.afterMessage$;
  }

  private static fromEvent<T>(vm: VM, eventName: 'beforeMessage' | 'afterMessage'): Observable<T> {
    const subject = new Subject<T>();
    vm.evm.events?.on(eventName, (event: any) => subject.next(event));
    return subject.asObservable().pipe(share());
  }
}
